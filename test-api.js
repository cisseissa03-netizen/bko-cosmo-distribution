const http = require('http');
const db = require('./server/database');

// We will start the server on a test port
process.env.PORT = '3001';
const server = require('./server/server');

// Wait 500ms for server to listen
setTimeout(async () => {
  console.log('🧪 Starting API Integration & Security Tests...\n');

  function request(options, postData) {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, raw: body });
          }
        });
      });
      req.on('error', reject);
      if (postData) {
        req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
      }
      req.end();
    });
  }

  try {
    const products = db.getProducts();
    const standardProduct = products.find(p => !p.allow3UnitsPermanent && !p.allow3UnitsSpecial);
    const techProduct = products.find(p => p.allow3UnitsPermanent);

    // 1. Test: Server rejects invalid quantity (e.g., standard product with 3 units)
    console.log('1. Testing server rejection of invalid quantity (qty=3 on standard product)...');
    const badRes1 = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      establishmentName: 'Pharmacie Test Bamako',
      establishmentType: 'Pharmacie',
      contactName: 'Dr. Test',
      phone: '+223 70 11 22 33',
      neighborhood: 'Hamdallaye ACI 2000',
      items: [{ productId: standardProduct.id, qty: 3 }]
    });

    if (badRes1.status === 400 && badRes1.data.error.includes('non respectée')) {
      console.log('  ✅ [PASS] Server rejected standard product with qty=3 (HTTP 400)');
    } else {
      throw new Error(`Expected 400, got ${badRes1.status}: ${JSON.stringify(badRes1.data)}`);
    }

    // 2. Test: Server rejects qty=9 on ANY product (even technical)
    console.log('2. Testing server rejection of qty=9 on technical product...');
    const badRes2 = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      establishmentName: 'Pharmacie Test Bamako',
      establishmentType: 'Pharmacie',
      contactName: 'Dr. Test',
      phone: '+223 70 11 22 34',
      neighborhood: 'Badalabougou',
      items: [{ productId: techProduct.id, qty: 9 }]
    });

    if (badRes2.status === 400) {
      console.log('  ✅ [PASS] Server rejected technical product with qty=9 (HTTP 400)');
    } else {
      throw new Error(`Expected 400, got ${badRes2.status}: ${JSON.stringify(badRes2.data)}`);
    }

    // 3. Test: Submitting a valid order request
    console.log('3. Testing valid order submission (Standard: 6, Technical: 3)...');
    const validRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      establishmentName: 'Pharmacie du Fleuve',
      establishmentType: 'Pharmacie',
      contactName: 'Dr. Coulibaly',
      phone: '+223 76 54 32 10',
      neighborhood: 'ACI 2000',
      address: 'En face de l\'Hôtel Radisson',
      items: [
        { productId: standardProduct.id, qty: 6 },
        { productId: techProduct.id, qty: 3 }
      ]
    });

    if (validRes.status === 201 && validRes.data.orderRef && validRes.data.whatsappUrl) {
      console.log(`  ✅ [PASS] Order submitted successfully: Ref=${validRes.data.orderRef}`);
    } else {
      throw new Error(`Valid submission failed: ${validRes.status} ${JSON.stringify(validRes.data)}`);
    }

    const createdRef = validRes.data.orderRef;

    // 4. Test: Order is persisted in DB immediately (even if WhatsApp is never sent!)
    console.log('4. Verifying order is saved in DB independently of WhatsApp click...');
    const savedOrders = db.getOrders();
    const foundOrder = savedOrders.find(o => o.orderRef === createdRef);
    if (foundOrder && foundOrder.status === 'Demande reçue' && foundOrder.items.length === 2) {
      console.log('  ✅ [PASS] Order is confirmed saved in persistent database!');
      console.log(`     Snapshotted items: ${foundOrder.items.map(i => `${i.name} (qty: ${i.qty}, unitPrice: ${i.unitPrice} FCFA)`).join(', ')}`);
    } else {
      throw new Error('Order not found in database!');
    }

    // 5. Test: Unauthenticated visitor blocked from accessing /api/admin/*
    console.log('5. Testing security: Unauthenticated visitor cannot access admin orders...');
    const unauthorizedRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/orders',
      method: 'GET'
    });

    if (unauthorizedRes.status === 401) {
      console.log('  ✅ [PASS] Anonymous access to admin orders blocked (HTTP 401)');
    } else {
      throw new Error(`Expected 401, got ${unauthorizedRes.status}`);
    }

    // 6. Test: Tracking endpoint does not leak client phone or establishment address
    console.log('6. Testing public tracking endpoint privacy...');
    const trackRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: `/api/orders/track/${createdRef}`,
      method: 'GET'
    });

    if (trackRes.status === 200 && trackRes.data.orderRef === createdRef) {
      if (trackRes.data.phone || trackRes.data.address || trackRes.data.contactName) {
        throw new Error('Privacy breach: Public tracking leaks private client data!');
      }
      console.log('  ✅ [PASS] Tracking returns only safe status without sensitive customer leaks');
    } else {
      throw new Error(`Tracking failed: ${trackRes.status}`);
    }

    console.log('\n🎉 ALL API & SECURITY TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test execution failed:', err);
    process.exit(1);
  }
}, 500);
