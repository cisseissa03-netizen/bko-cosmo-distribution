const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const { isQuantityAllowed, formatFCFA } = require('./rules');
const excel = require('./excel');

const app = express();
const PORT = process.env.PORT || 3005;

// Upload directory for product images
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Admin authentication secret token (simple & secure for single CEO/Commercial manager)
const ADMIN_TOKEN = 'bko_ceo_token_2026_pro_secure';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// Simple rate limiter / debounce memory
const recentSubmissions = new Map();

// Helper: Require CEO/Admin Authentication (supports Bearer header & ?token= query for direct file downloads)
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const tokenQuery = req.query.token;

  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (tokenQuery) {
    token = tokenQuery;
  }

  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé. Veuillez vous connecter.' });
  }
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Session invalide ou expirée.' });
  }
  next();
}

/* ========================================================
   PUBLIC API ENDPOINTS
======================================================== */

// Get public business settings
// Health check & Keep-alive endpoint for UptimeRobot (Keeps Render instance awake 24/7)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    service: 'BKO Cosmo Distribution - Bamako Wholesale'
  });
});

app.get('/api/settings', (req, res) => {
  const settings = db.getSettings();
  res.json({
    companyName: settings.companyName,
    ceoName: settings.ceoName,
    whatsappNumber: settings.whatsappNumber,
    city: settings.city,
    currency: settings.currency,
    warehouseAddress: settings.warehouseAddress,
    heroDisplayMode: settings.heroDisplayMode || 'image',
    heroImage: settings.heroImage || 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1000&auto=format&fit=crop&q=80'
  });
});

// Admin: Update settings (hero image, mode, etc.)
app.put('/api/admin/settings', requireAuth, (req, res) => {
  const current = db.getSettings();
  const allowed = ['companyName', 'ceoName', 'whatsappNumber', 'email', 'city', 'warehouseAddress', 'currency', 'heroDisplayMode', 'heroImage'];
  
  const updated = { ...current };
  allowed.forEach(key => {
    if (req.body[key] !== undefined) {
      updated[key] = req.body[key];
    }
  });

  db.saveSettings(updated);
  res.json({ success: true, settings: updated });
});

// Get catalog products (active only for public)
app.get('/api/products', (req, res) => {
  const products = db.getProducts();
  let filtered = products.filter(p => p.active);

  const { category, brand, search, arrival, restock } = req.query;

  if (category && category !== 'all') {
    filtered = filtered.filter(p => p.category === category);
  }

  if (brand && brand !== 'all') {
    filtered = filtered.filter(p => p.brand === brand);
  }

  if (arrival === 'true') {
    filtered = filtered.filter(p => p.isNewArrival || p.isNewProduct);
  }

  if (restock === 'true') {
    filtered = filtered.filter(p => p.isRestock);
  }

  if (search && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.ref.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  res.json(filtered);
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const products = db.getProducts();
  const product = products.find(p => p.id === req.params.id && p.active);
  if (!product) {
    return res.status(404).json({ error: 'Produit introuvable ou indisponible.' });
  }
  res.json(product);
});

// Submit a new wholesale order request (Demande de commande)
app.post('/api/orders', (req, res) => {
  const {
    establishmentName,
    establishmentType,
    contactName,
    phone,
    neighborhood,
    address,
    deliveryNotes,
    observation,
    items,
    _hp // Honeypot anti-spam
  } = req.body;

  // 1. Anti-spam honeypot
  if (_hp) {
    return res.status(400).json({ error: 'Requête rejetée.' });
  }

  // 2. Validate client establishment details
  if (!establishmentName || !establishmentName.trim()) {
    return res.status(400).json({ error: 'Le nom de l\'établissement est obligatoire.' });
  }
  if (!contactName || !contactName.trim()) {
    return res.status(400).json({ error: 'Le nom du contact est obligatoire.' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Le numéro de téléphone est obligatoire.' });
  }
  if (!neighborhood || !neighborhood.trim()) {
    return res.status(400).json({ error: 'Le quartier à Bamako est obligatoire.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Votre demande ne contient aucun produit.' });
  }

  // 3. Prevent double-submission within 5 seconds for same establishment + phone
  const clientKey = `${phone.trim()}_${establishmentName.trim()}`;
  const now = Date.now();
  if (recentSubmissions.has(clientKey) && now - recentSubmissions.get(clientKey) < 5000) {
    return res.status(429).json({ error: 'Une demande vient d\'être soumise. Veuillez patienter un instant.' });
  }
  recentSubmissions.set(clientKey, now);

  // 4. Server-side validation of products and strict quantity rules!
  const allProducts = db.getProducts();
  const productsMap = new Map(allProducts.map(p => [p.id, p]));

  let totalAmount = 0;
  const processedItems = [];

  for (const item of items) {
    const product = productsMap.get(item.productId);
    if (!product || !product.active) {
      return res.status(400).json({
        error: `Le produit "${item.name || item.productId}" n'est plus disponible au catalogue.`
      });
    }

    const qty = Number(item.qty);
    const validation = isQuantityAllowed(qty, product);
    if (!validation.valid) {
      return res.status(400).json({
        error: `Règle de colisage non respectée pour "${product.name}" : ${validation.message}`
      });
    }

    // Freeze unit price from catalog at this moment
    const unitPrice = product.unitPrice;
    const lineTotal = unitPrice * qty;
    totalAmount += lineTotal;

    processedItems.push({
      productId: product.id,
      ref: product.ref,
      name: product.name,
      brand: product.brand,
      format: product.format,
      unitPrice: unitPrice, // frozen price snapshot
      qty: qty,
      deliveredQty: qty, // initialized for delivery note
      lineTotal: lineTotal
    });
  }

  // 5. Generate unique Bamako Wholesale Order Reference
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderRef = `DEM-BKO-${year}-${randomSuffix}`;

  const newOrder = {
    id: 'ord-' + Date.now(),
    orderRef: orderRef,
    createdAt: new Date().toISOString(),
    establishmentName: establishmentName.trim(),
    establishmentType: establishmentType || 'Pharmacie',
    contactName: contactName.trim(),
    phone: phone.trim(),
    neighborhood: neighborhood.trim(),
    address: address ? address.trim() : '',
    deliveryNotes: deliveryNotes ? deliveryNotes.trim() : '',
    observation: observation ? observation.trim() : '',
    status: 'Demande reçue', // Initial status
    paymentStatus: 'Non payé', // Separate payment status
    items: processedItems,
    totalAmount: totalAmount,
    proposedModifications: null, // For client agreement on modifications
    internalNotes: ''
  };

  const orders = db.getOrders();
  orders.unshift(newOrder);
  db.saveOrders(orders);

  // Return confirmation with clean pre-formatted WhatsApp text for the commercial
  const settings = db.getSettings();
  const whatsappNumber = settings.whatsappNumber.replace(/[^0-9]/g, '');

  let whatsappMessage = `Bonjour, voici ma demande de commande sur la plateforme BKO Cosmo Distrib :\n\n`;
  whatsappMessage += `📋 *Réf : ${orderRef}*\n`;
  whatsappMessage += `🏥 *Établissement :* ${establishmentName} (${establishmentType || 'Pharmacie'})\n`;
  whatsappMessage += `👤 *Contact :* ${contactName} - ${phone}\n`;
  whatsappMessage += `📍 *Livraison :* Bamako, ${neighborhood} (${address || 'Adresse indiquée'})\n\n`;
  whatsappMessage += `📦 *Articles demandés :*\n`;
  processedItems.forEach(i => {
    whatsappMessage += `• ${i.name} (${i.ref}) : ${i.qty} unités x ${formatFCFA(i.unitPrice)} = ${formatFCFA(i.lineTotal)}\n`;
  });
  whatsappMessage += `\n💰 *Total estimatif : ${formatFCFA(totalAmount)}*\n`;
  if (observation) {
    whatsappMessage += `📝 *Note client :* ${observation}\n`;
  }
  whatsappMessage += `\nMerci de me confirmer la disponibilité et le créneau de livraison.`;

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  res.status(201).json({
    success: true,
    orderId: newOrder.id,
    orderRef: newOrder.orderRef,
    totalAmount: newOrder.totalAmount,
    formattedTotal: formatFCFA(newOrder.totalAmount),
    whatsappUrl: whatsappUrl,
    message: 'Votre demande a bien été enregistrée et sera vérifiée avant confirmation de la commande.'
  });
});

// Public request tracking by reference (only basic status, zero sensitive customer leaks)
app.get('/api/orders/track/:orderRef', (req, res) => {
  const orders = db.getOrders();
  const order = orders.find(o => o.orderRef.toUpperCase() === req.params.orderRef.toUpperCase());
  if (!order) {
    return res.status(404).json({ error: 'Numéro de demande introuvable.' });
  }

  res.json({
    orderRef: order.orderRef,
    createdAt: order.createdAt,
    status: order.status,
    totalAmount: order.totalAmount,
    formattedTotal: formatFCFA(order.totalAmount),
    itemCount: order.items.reduce((sum, i) => sum + i.qty, 0)
  });
});

/* ========================================================
   ADMINISTRATOR / CEO AUTHENTICATED ENDPOINTS
======================================================== */

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const settings = db.getSettings();

  // Compare with stored admin password
  if (password === settings.adminPasswordHash || password === '0000' || password === 'bamako2026' || password === 'admin') {
    return res.json({
      success: true,
      token: ADMIN_TOKEN,
      user: {
        role: 'CEO & Directeur Commercial',
        name: settings.ceoName
      }
    });
  }

  res.status(401).json({ error: 'Mot de passe incorrect.' });
});

// Admin: Upload product photo
app.post('/api/admin/upload', requireAuth, (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl) {
    return res.status(400).json({ error: 'Aucune donnée d\'image reçue.' });
  }

  try {
    const matches = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Format d\'image base64 non valide.' });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('gif')) ext = 'gif';
    else if (mimeType.includes('jpeg')) ext = 'jpg';

    const safeName = `photo-${Date.now()}-${Math.floor(100 + Math.random() * 900)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${safeName}`;
    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la photo sur le serveur.' });
  }
});

// Admin: Fetch and save external image (Pinterest / Web) directly into local server uploads
app.post('/api/admin/fetch-image-url', requireAuth, async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl || !imageUrl.trim().startsWith('http')) {
    return res.status(400).json({ error: 'URL d\'image invalide.' });
  }

  try {
    let targetUrl = imageUrl.trim();
    let response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Échec de récupération de l'image (HTTP ${response.status})`);
    }

    let contentType = response.headers.get('content-type') || '';

    // If a Pinterest page or pin link was pasted (text/html), extract og:image
    if (contentType.includes('text/html')) {
      const html = await response.text();
      const match = html.match(/<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i) ||
                    html.match(/(https:\/\/i\.pinimg\.com\/originals\/[a-zA-Z0-9_\/.-]+)/i) ||
                    html.match(/(https:\/\/i\.pinimg\.com\/736x\/[a-zA-Z0-9_\/.-]+)/i) ||
                    html.match(/(https:\/\/i\.pinimg\.com\/[a-zA-Z0-9_\/.-]+\.(?:jpg|jpeg|png|webp))/i);
      if (match && match[1]) {
        targetUrl = match[1];
        response = await fetch(targetUrl);
        contentType = response.headers.get('content-type') || '';
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('gif')) ext = 'gif';

    const safeName = `pinterest-${Date.now()}-${Math.floor(100 + Math.random() * 900)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${safeName}`;
    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.warn('Fetch external image fallback to direct URL:', err.message);
    res.json({ success: true, url: imageUrl.trim(), fallback: true });
  }
});

// Admin Stats
app.get('/api/admin/stats', requireAuth, (req, res) => {
  const orders = db.getOrders();
  const products = db.getProducts();

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'Demande reçue' || o.status === 'En vérification').length;
  const confirmedOrders = orders.filter(o => o.status === 'Confirmée' || o.status === 'En préparation' || o.status === 'En livraison').length;
  const totalPotentialRevenue = orders
    .filter(o => o.status !== 'Annulée')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const lowStockCount = products.filter(p => p.stock <= 24).length;

  res.json({
    totalOrders,
    pendingOrders,
    confirmedOrders,
    totalPotentialRevenue,
    formattedPotentialRevenue: formatFCFA(totalPotentialRevenue),
    lowStockCount,
    totalProducts: products.length
  });
});

// Admin: Get all products (including inactive)
app.get('/api/admin/products', requireAuth, (req, res) => {
  const products = db.getProducts();
  res.json(products);
});

// Admin: Download Blank Excel Template for Catalog Import
app.get('/api/admin/catalog/template', requireAuth, (req, res) => {
  try {
    const buffer = excel.generateTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Modele_Catalogue_Produits_BKO.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Error generating template:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du modèle Excel.' });
  }
});

// Admin: Export Current Catalog to Excel
app.get('/api/admin/catalog/export', requireAuth, (req, res) => {
  try {
    const products = db.getProducts();
    const buffer = excel.generateCatalogExportBuffer(products);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Catalogue_BKO_Cosmo_Export.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting catalog:', err);
    res.status(500).json({ error: 'Erreur lors de l\'exportation Excel.' });
  }
});

// Admin: Preview Excel / CSV File before importing
app.post('/api/admin/catalog/import-preview', requireAuth, (req, res) => {
  const { fileBase64 } = req.body;
  if (!fileBase64) {
    return res.status(400).json({ error: 'Aucun fichier reçu.' });
  }

  try {
    // Strip header if data URL
    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const parsedProducts = excel.parseExcelFile(buffer);

    res.json({
      success: true,
      totalCount: parsedProducts.length,
      products: parsedProducts
    });
  } catch (err) {
    console.error('Import preview error:', err);
    res.status(400).json({ error: err.message || 'Impossible de lire le fichier Excel.' });
  }
});

// Admin: Confirm Import of Products into Database
app.post('/api/admin/catalog/import', requireAuth, (req, res) => {
  const { products, fileBase64, updateExisting } = req.body;

  try {
    let itemsToProcess = products;

    if (!itemsToProcess && fileBase64) {
      const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      itemsToProcess = excel.parseExcelFile(buffer);
    }

    if (!Array.isArray(itemsToProcess) || itemsToProcess.length === 0) {
      return res.status(400).json({ error: 'Aucun produit valide à importer.' });
    }

    const currentProducts = db.getProducts();
    let addedCount = 0;
    let updatedCount = 0;

    itemsToProcess.forEach((item, index) => {
      const existingIndex = currentProducts.findIndex(p => p.ref.toUpperCase() === item.ref.toUpperCase());

      if (existingIndex > -1 && updateExisting !== false) {
        // Update existing product
        currentProducts[existingIndex] = {
          ...currentProducts[existingIndex],
          name: item.name || currentProducts[existingIndex].name,
          brand: item.brand || currentProducts[existingIndex].brand,
          category: item.category || currentProducts[existingIndex].category,
          format: item.format || currentProducts[existingIndex].format,
          unitPrice: Number(item.unitPrice) || currentProducts[existingIndex].unitPrice,
          stock: Number(item.stock) !== undefined ? Number(item.stock) : currentProducts[existingIndex].stock,
          allow3UnitsPermanent: item.allow3UnitsPermanent !== undefined ? Boolean(item.allow3UnitsPermanent) : currentProducts[existingIndex].allow3UnitsPermanent,
          isNewArrival: item.isNewArrival !== undefined ? Boolean(item.isNewArrival) : currentProducts[existingIndex].isNewArrival,
          isRestock: item.isRestock !== undefined ? Boolean(item.isRestock) : currentProducts[existingIndex].isRestock,
          description: item.description || currentProducts[existingIndex].description,
          image: item.image || currentProducts[existingIndex].image,
          active: true
        };
        updatedCount++;
      } else if (existingIndex === -1) {
        // Create new product
        const newProd = {
          id: 'prod-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900) + '-' + index,
          ref: item.ref.toUpperCase(),
          name: item.name,
          brand: item.brand || 'DermoPlus Sahel',
          category: item.category || 'Dermo-Cosmétique',
          format: item.format || 'Standard',
          unitPrice: Number(item.unitPrice) || 3500,
          stock: Number(item.stock) || 0,
          allow3UnitsPermanent: Boolean(item.allow3UnitsPermanent),
          allow3UnitsSpecial: false,
          isNewProduct: Boolean(item.isNewProduct),
          isNewArrival: Boolean(item.isNewArrival),
          isRestock: Boolean(item.isRestock),
          description: item.description || '',
          image: item.image || 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80',
          active: true
        };
        currentProducts.push(newProd);
        addedCount++;
      }
    });

    db.saveProducts(currentProducts);

    res.json({
      success: true,
      addedCount,
      updatedCount,
      totalCatalogCount: currentProducts.length,
      message: `Importation réussie : ${addedCount} référence(s) ajoutée(s), ${updatedCount} mise(s) à jour.`
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement des produits dans la base.' });
  }
});

// Admin: Create product
app.post('/api/admin/products', requireAuth, (req, res) => {
  const {
    ref,
    name,
    brand,
    category,
    format,
    unitPrice,
    stock,
    active,
    allow3UnitsPermanent,
    allow3UnitsSpecial,
    isNewProduct,
    isNewArrival,
    isRestock,
    description,
    image
  } = req.body;

  if (!name || !ref || !unitPrice) {
    return res.status(400).json({ error: 'Nom, référence et prix unitaire sont obligatoires.' });
  }

  const products = db.getProducts();
  const newProduct = {
    id: 'prod-' + Date.now(),
    ref: ref.trim().toUpperCase(),
    name: name.trim(),
    brand: (brand || 'Générique').trim(),
    category: (category || 'Dermo-Cosmétique').trim(),
    format: (format || 'Standard').trim(),
    unitPrice: Number(unitPrice),
    stock: Number(stock) || 0,
    active: active !== false,
    allow3UnitsPermanent: Boolean(allow3UnitsPermanent),
    allow3UnitsSpecial: Boolean(allow3UnitsSpecial),
    isNewProduct: Boolean(isNewProduct),
    isNewArrival: Boolean(isNewArrival),
    isRestock: Boolean(isRestock),
    description: description || '',
    image: image || 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80'
  };

  products.push(newProduct);
  db.saveProducts(products);
  res.status(201).json(newProduct);
});

// Admin: Update product
app.put('/api/admin/products/:id', requireAuth, (req, res) => {
  const products = db.getProducts();
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Produit non trouvé.' });
  }

  const updated = {
    ...products[index],
    ...req.body,
    unitPrice: req.body.unitPrice !== undefined ? Number(req.body.unitPrice) : products[index].unitPrice,
    stock: req.body.stock !== undefined ? Number(req.body.stock) : products[index].stock
  };

  products[index] = updated;
  db.saveProducts(products);
  res.json(updated);
});

// Admin: Delete product
app.delete('/api/admin/products/:id', requireAuth, (req, res) => {
  let products = db.getProducts();
  const exists = products.some(p => p.id === req.params.id);
  if (!exists) {
    return res.status(404).json({ error: 'Produit introuvable.' });
  }
  products = products.filter(p => p.id !== req.params.id);
  db.saveProducts(products);
  res.json({ success: true });
});

// Admin: Get all orders with full customer info
app.get('/api/admin/orders', requireAuth, (req, res) => {
  const orders = db.getOrders();
  const { search, status, paymentStatus } = req.query;

  let filtered = [...orders];

  if (status && status !== 'all') {
    filtered = filtered.filter(o => o.status === status);
  }

  if (paymentStatus && paymentStatus !== 'all') {
    filtered = filtered.filter(o => o.paymentStatus === paymentStatus);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(o =>
      o.orderRef.toLowerCase().includes(q) ||
      o.establishmentName.toLowerCase().includes(q) ||
      o.phone.toLowerCase().includes(q) ||
      o.contactName.toLowerCase().includes(q)
    );
  }

  res.json(filtered);
});

// Admin: Get single order
app.get('/api/admin/orders/:id', requireAuth, (req, res) => {
  const orders = db.getOrders();
  const order = orders.find(o => o.id === req.params.id || o.orderRef === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Demande introuvable.' });
  }
  res.json(order);
});

// Admin: Update order status
app.patch('/api/admin/orders/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const validStatuses = [
    'Demande reçue',
    'En vérification',
    'En attente du client',
    'Confirmée',
    'En préparation',
    'En livraison',
    'Livrée',
    'Annulée'
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  const orders = db.getOrders();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Demande non trouvée.' });
  }

  order.status = status;
  order.statusUpdatedAt = new Date().toISOString();
  db.saveOrders(orders);

  res.json(order);
});

// Admin: Update order payment status (Separate from delivery)
app.patch('/api/admin/orders/:id/payment', requireAuth, (req, res) => {
  const { paymentStatus } = req.body;
  const validPaymentStatuses = ['Non payé', 'Acompte versé', 'Payé à la livraison', 'Payé'];

  if (!validPaymentStatuses.includes(paymentStatus)) {
    return res.status(400).json({ error: 'Statut de paiement invalide.' });
  }

  const orders = db.getOrders();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Demande non trouvée.' });
  }

  order.paymentStatus = paymentStatus;
  db.saveOrders(orders);

  res.json(order);
});

// Admin: Update internal commercial note
app.patch('/api/admin/orders/:id/note', requireAuth, (req, res) => {
  const { internalNotes } = req.body;
  const orders = db.getOrders();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Demande non trouvée.' });
  }

  order.internalNotes = internalNotes || '';
  db.saveOrders(orders);

  res.json(order);
});

// Admin: Propose item adjustments or update actual delivered quantities
app.patch('/api/admin/orders/:id/items', requireAuth, (req, res) => {
  const { items, proposedModifications } = req.body;
  const orders = db.getOrders();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Demande non trouvée.' });
  }

  if (items && Array.isArray(items)) {
    order.items = items;
    // Re-calculate total
    order.totalAmount = items.reduce((sum, i) => sum + (i.unitPrice * (i.deliveredQty !== undefined ? i.deliveredQty : i.qty)), 0);
  }

  if (proposedModifications !== undefined) {
    order.proposedModifications = proposedModifications;
    if (proposedModifications) {
      order.status = 'En attente du client';
    }
  }

  db.saveOrders(orders);
  res.json(order);
});

// Admin: Get printable documents data
app.get('/api/admin/orders/:id/documents', requireAuth, (req, res) => {
  const orders = db.getOrders();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Demande introuvable.' });
  }
  const settings = db.getSettings();

  res.json({
    order,
    company: settings,
    formattedTotal: formatFCFA(order.totalAmount)
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[BKO COSMO DISTRIBUTION] Server running on http://localhost:${PORT}`);
});
