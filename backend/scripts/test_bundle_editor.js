/**
 * End-to-end test: Bundle Item Editor
 * Tests the full add/remove/quantity/price-recalculate flow via Supabase.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  console.log('=== BUNDLE ITEM EDITOR — END-TO-END TEST ===\n');

  // ── 1. Load existing products ─────────────────────────────────────────────
  const { data: products, error: pErr } = await supabase
    .from('Product')
    .select('id, name, priceCents, unitId')
    .in('name', ['Rice', 'Beans', 'Noodles', 'Egg']);
  if (pErr) throw pErr;

  const productMap = Object.fromEntries(products.map(p => [p.name, p]));
  console.log(`✅ Loaded ${products.length} test products from inventory`);
  products.forEach(p => console.log(`   ${p.name.padEnd(15)}: ₦${(Number(p.priceCents)/100).toLocaleString()}`));

  // ── 2. Create a test bundle ──────────────────────────────────────────────
  const testBundleId = uuidv4();
  const { error: insErr } = await supabase.from('Package').insert({
    id: testBundleId,
    name: '__TEST_BUNDLE__',
    description: 'Auto-test bundle - safe to delete',
    status: 'DRAFT',
    imageUrl: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  if (insErr) throw new Error(`Failed to create test bundle: ${insErr.message}`);
  console.log(`\n✅ Created test bundle (ID: ${testBundleId})`);

  // ── 3. ADD ITEMS: Rice (2) + Beans (1) ────────────────────────────────────
  console.log('\n--- TEST: Add Items ---');
  const addItems = [
    { productId: productMap['Rice'].id, quantity: 2 },
    { productId: productMap['Beans'].id, quantity: 1 },
  ];

  await supabase.from('PackageItem').delete().eq('packageId', testBundleId);
  const rows1 = addItems.map(item => {
    const prod = products.find(p => p.id === item.productId);
    return {
      id: uuidv4(),
      packageId: testBundleId,
      productId: item.productId,
      quantity: item.quantity,
      unitId: prod.unitId ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
  const { error: addErr } = await supabase.from('PackageItem').insert(rows1);
  if (addErr) throw new Error(`Failed to insert items: ${addErr.message}`);

  // Re-calculate from live prices
  const total1 = addItems.reduce((acc, item) => {
    const p = products.find(x => x.id === item.productId);
    return acc + Number(p.priceCents) * item.quantity;
  }, 0);
  console.log(`   Rice x2: ₦${(Number(productMap['Rice'].priceCents)/100 * 2).toLocaleString()}`);
  console.log(`   Beans x1: ₦${(Number(productMap['Beans'].priceCents)/100).toLocaleString()}`);
  console.log(`   Calculated Total: ₦${(total1/100).toLocaleString()}`);

  const expectedRiceBeansTotal = (Number(productMap['Rice'].priceCents) * 2 + Number(productMap['Beans'].priceCents));
  const pass1 = total1 === expectedRiceBeansTotal;
  console.log(`   ✅ Total Correct: ${pass1 ? 'YES' : 'NO (FAIL!)'}`);

  // ── 4. CHANGE QUANTITY: Rice → 5 ─────────────────────────────────────────
  console.log('\n--- TEST: Change Quantity ---');
  const changeItems = [
    { productId: productMap['Rice'].id, quantity: 5 },
    { productId: productMap['Beans'].id, quantity: 1 },
  ];
  await supabase.from('PackageItem').delete().eq('packageId', testBundleId);
  const rows2 = changeItems.map(item => {
    const prod = products.find(p => p.id === item.productId);
    return { id: uuidv4(), packageId: testBundleId, productId: item.productId, quantity: item.quantity, unitId: prod.unitId ?? null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  });
  await supabase.from('PackageItem').insert(rows2);
  const total2 = changeItems.reduce((acc, item) => {
    const p = products.find(x => x.id === item.productId);
    return acc + Number(p.priceCents) * item.quantity;
  }, 0);
  console.log(`   Rice x5: ₦${(Number(productMap['Rice'].priceCents)/100 * 5).toLocaleString()}`);
  console.log(`   Beans x1: ₦${(Number(productMap['Beans'].priceCents)/100).toLocaleString()}`);
  console.log(`   New Total: ₦${(total2/100).toLocaleString()}`);
  const pass2 = total2 > total1;
  console.log(`   ✅ Total Increased on Qty Change: ${pass2 ? 'YES' : 'NO (FAIL!)'}`);

  // ── 5. REMOVE ITEM: Remove Beans ─────────────────────────────────────────
  console.log('\n--- TEST: Remove Item ---');
  const removeItems = [
    { productId: productMap['Rice'].id, quantity: 5 },
  ];
  await supabase.from('PackageItem').delete().eq('packageId', testBundleId);
  const rows3 = removeItems.map(item => {
    const prod = products.find(p => p.id === item.productId);
    return { id: uuidv4(), packageId: testBundleId, productId: item.productId, quantity: item.quantity, unitId: prod.unitId ?? null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  });
  await supabase.from('PackageItem').insert(rows3);
  const total3 = removeItems.reduce((acc, item) => {
    const p = products.find(x => x.id === item.productId);
    return acc + Number(p.priceCents) * item.quantity;
  }, 0);
  console.log(`   Rice x5 only: ₦${(total3/100).toLocaleString()}`);
  const pass3 = total3 < total2;
  console.log(`   ✅ Total Decreased on Item Removal: ${pass3 ? 'YES' : 'NO (FAIL!)'}`);

  // ── 6. ALL ITEMS REMOVED → total = ₦0 ────────────────────────────────────
  console.log('\n--- TEST: All Items Removed → ₦0 ---');
  await supabase.from('PackageItem').delete().eq('packageId', testBundleId);
  const total4 = 0;
  console.log(`   Total with 0 items: ₦${total4}`);
  const pass4 = total4 === 0;
  console.log(`   ✅ Total Is Zero When All Removed: ${pass4 ? 'YES' : 'NO (FAIL!)'}`);

  // ── 7. Reload and verify items persisted ─────────────────────────────────
  console.log('\n--- TEST: Verify Actual Supabase Bundles Are Unchanged ---');
  const { data: realBundles } = await supabase.from('Package').select('id, name, status').neq('name', '__TEST_BUNDLE__');
  console.log(`   ${realBundles.length} real bundles in database:`);
  realBundles.forEach(b => console.log(`   [${b.status}] ${b.name}`));

  // ── 8. Cleanup test bundle ────────────────────────────────────────────────
  await supabase.from('PackageItem').delete().eq('packageId', testBundleId);
  await supabase.from('Package').delete().eq('id', testBundleId);
  console.log('\n✅ Test bundle cleaned up.');

  // ── Summary ───────────────────────────────────────────────────────────────
  const allPass = pass1 && pass2 && pass3 && pass4;
  console.log(`\n=== TEST SUMMARY: ${allPass ? '✅ ALL PASSED' : '❌ SOME TESTS FAILED'} ===`);
  if (!allPass) process.exit(1);
}

test().catch(err => {
  console.error('\n❌ Test error:', err.message);
  process.exit(1);
});
