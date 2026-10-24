const assert = require('assert');
const { isQuantityAllowed, getNextQuantity, getPrevQuantity, formatFCFA } = require('./server/rules');
const db = require('./server/database');

console.log('🧪 Starting Automated Verification of Business Rules & Commercial Logic...\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

// Mock products
const normalProduct = {
  id: 'test-norm',
  name: 'Lait Corporel Standard',
  stock: 100,
  allow3UnitsPermanent: false,
  allow3UnitsSpecial: false
};

const technicalProduct = {
  id: 'test-tech',
  name: 'Sérum Dermatologique Technique',
  stock: 50,
  allow3UnitsPermanent: true,
  allow3UnitsSpecial: false
};

const lowStockProduct = {
  id: 'test-low',
  name: 'Huile Argan Exception Stock',
  stock: 12,
  allow3UnitsPermanent: false,
  allow3UnitsSpecial: true
};

// 1. Tests for Normal Product
console.log('--- 1. Testing Normal Product (Standard 6-unit rule) ---');

test('Normal product accepts 6 units', () => {
  const res = isQuantityAllowed(6, normalProduct);
  assert.strictEqual(res.valid, true);
});

test('Normal product accepts 12 units', () => {
  const res = isQuantityAllowed(12, normalProduct);
  assert.strictEqual(res.valid, true);
});

test('Normal product accepts 18 units', () => {
  const res = isQuantityAllowed(18, normalProduct);
  assert.strictEqual(res.valid, true);
});

test('Normal product strictly REFUSES 3 units', () => {
  const res = isQuantityAllowed(3, normalProduct);
  assert.strictEqual(res.valid, false);
});

test('Normal product strictly REFUSES 9 units', () => {
  const res = isQuantityAllowed(9, normalProduct);
  assert.strictEqual(res.valid, false);
});

test('Normal product strictly REFUSES 15 units', () => {
  const res = isQuantityAllowed(15, normalProduct);
  assert.strictEqual(res.valid, false);
});

test('Normal product selector steps 6 -> 12 -> 18', () => {
  assert.strictEqual(getNextQuantity(6, normalProduct), 12);
  assert.strictEqual(getNextQuantity(12, normalProduct), 18);
  assert.strictEqual(getPrevQuantity(18, normalProduct), 12);
  assert.strictEqual(getPrevQuantity(12, normalProduct), 6);
  assert.strictEqual(getPrevQuantity(6, normalProduct), 6); // Cannot go below 6
});

// 2. Tests for 3-Unit Exception Product
console.log('\n--- 2. Testing 3-Unit Exception Product (Technical or Admin Low-Stock) ---');

test('Technical product accepts 3 units', () => {
  const res = isQuantityAllowed(3, technicalProduct);
  assert.strictEqual(res.valid, true);
});

test('Technical product accepts 6 units', () => {
  const res = isQuantityAllowed(6, technicalProduct);
  assert.strictEqual(res.valid, true);
});

test('Technical product accepts 12 units', () => {
  const res = isQuantityAllowed(12, technicalProduct);
  assert.strictEqual(res.valid, true);
});

test('Technical product accepts 18 units', () => {
  const res = isQuantityAllowed(18, technicalProduct);
  assert.strictEqual(res.valid, true);
});

test('Technical product strictly REFUSES 9 units', () => {
  const res = isQuantityAllowed(9, technicalProduct);
  assert.strictEqual(res.valid, false);
});

test('Technical product strictly REFUSES 15 units', () => {
  const res = isQuantityAllowed(15, technicalProduct);
  assert.strictEqual(res.valid, false);
});

test('Technical product selector steps 3 -> 6 -> 12 -> 18', () => {
  assert.strictEqual(getNextQuantity(3, technicalProduct), 6);
  assert.strictEqual(getNextQuantity(6, technicalProduct), 12);
  assert.strictEqual(getNextQuantity(12, technicalProduct), 18);
  assert.strictEqual(getPrevQuantity(18, technicalProduct), 12);
  assert.strictEqual(getPrevQuantity(12, technicalProduct), 6);
  assert.strictEqual(getPrevQuantity(6, technicalProduct), 3); // Down to 3
  assert.strictEqual(getPrevQuantity(3, technicalProduct), 3); // Cannot go below 3
});

// 3. Tests for Reference Independence (No Compensation)
console.log('\n--- 3. Testing Reference Independence ---');

test('Two separate standard references with 3 units each remain independently invalid', () => {
  const itemA = { product: normalProduct, qty: 3 };
  const itemB = { product: { ...normalProduct, id: 'test-norm-2' }, qty: 3 };

  // Even if total is 6 units, both individual items are invalid
  const validA = isQuantityAllowed(itemA.qty, itemA.product).valid;
  const validB = isQuantityAllowed(itemB.qty, itemB.product).valid;

  assert.strictEqual(validA, false, 'Reference A with 3 units must be rejected');
  assert.strictEqual(validB, false, 'Reference B with 3 units must be rejected');
});

// 4. Stock limits
console.log('\n--- 4. Testing Stock Limit Constraints ---');

test('Quantity cannot exceed available stock', () => {
  const res = isQuantityAllowed(18, lowStockProduct); // Stock is 12
  assert.strictEqual(res.valid, false);
  assert.match(res.message, /Stock insuffisant/);
});

test('Quantity within stock is accepted', () => {
  const res = isQuantityAllowed(12, lowStockProduct); // Stock is 12
  assert.strictEqual(res.valid, true);
});

// 5. Database & Price Snapshot Verification
console.log('\n--- 5. Database & Price Snapshot Verification ---');

test('Database products are accessible and properly seeded', () => {
  const prods = db.getProducts();
  assert.ok(Array.isArray(prods));
  assert.ok(prods.length >= 10);
  const tech = prods.find(p => p.allow3UnitsPermanent);
  assert.ok(tech, 'Should have at least one technical product with 3 units permanent');
});

test('Currency formatting displays FCFA correctly', () => {
  const formatted = formatFCFA(12500);
  assert.ok(formatted.includes('12') && formatted.includes('500') && formatted.includes('FCFA'));
});

console.log(`\n========================================`);
console.log(`Results: ${passedTests}/${totalTests} tests passed.`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
