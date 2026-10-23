// backend/scripts/seed_bundles.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BUNDLE_DEFINITIONS = [
  {
    name: 'Affy Student Essentials',
    description: 'An affordable mix of staples and quick meals.',
    badge: 'Budget Student Essential',
    priceNaira: 11530,
    status: 'ACTIVE',
    bestFor: 'Students & singles needing reliable weekly staple groceries',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
    items: [
      { name: 'Rice', quantity: 1, amountNaira: 2000 },
      { name: 'Garri', quantity: 2, amountNaira: 800 },
      { name: 'Beans', quantity: 1, amountNaira: 2200 },
      { name: 'Spaghetti', quantity: 2, amountNaira: 1900 },
      { name: 'Noodles', quantity: 5, amountNaira: 1850 },
      { name: 'Egg', quantity: 6, amountNaira: 1500, displayName: 'Eggs' },
      { name: 'Maggi', quantity: 1, amountNaira: 350 },
      { name: 'Salt', quantity: 1, amountNaira: 250 },
      { name: 'Sachet Tomato', quantity: 4, amountNaira: 680 },
    ],
  },
  {
    name: 'Affy Solo Living Package',
    description: 'For bachelors and spinsters who want variety for everyday cooking.',
    badge: 'Solo Living',
    priceNaira: 20070,
    status: 'DRAFT', // Saved as DRAFT per Part 3 requirement: missing Sardines in inventory
    bestFor: 'Bachelors and spinsters who want variety for everyday cooking',
    imageUrl: 'https://images.unsplash.com/photo-1506484381205-f7945653044d?auto=format&fit=crop&w=800&q=80',
    items: [
      { name: 'Rice', quantity: 2, amountNaira: 4000 },
      { name: 'Garri', quantity: 2, amountNaira: 800 },
      { name: 'Beans', quantity: 1, amountNaira: 2200 },
      { name: 'Spaghetti', quantity: 3, amountNaira: 2850 },
      { name: 'Noodles', quantity: 5, amountNaira: 1850 },
      { name: 'Egg', quantity: 10, amountNaira: 2500, displayName: 'Eggs' },
      { name: 'Butter', quantity: 1, amountNaira: 1500 },
      { name: 'Maggi', quantity: 2, amountNaira: 700 },
      { name: 'Salt', quantity: 1, amountNaira: 250 },
      { name: 'Curry', quantity: 2, amountNaira: 200 },
      { name: 'Thyme', quantity: 2, amountNaira: 200 },
      { name: 'Sardines', quantity: 2, amountNaira: 2000, missingFromInventory: true },
      { name: 'Sachet Tomato', quantity: 6, amountNaira: 1020 },
    ],
  },
  {
    name: 'Affy Family & Kids Package',
    description: 'Household staples with breakfast options for the children.',
    badge: 'Family & Breakfast',
    priceNaira: 50500,
    status: 'DRAFT', // Saved as DRAFT per Part 3 requirement: missing Golden Morn, Dano Milk, and Milo price discrepancy
    bestFor: 'Household staples with breakfast options for the children',
    imageUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=800&q=80',
    items: [
      { name: 'Rice', quantity: 5, amountNaira: 10000 },
      { name: 'Garri', quantity: 3, amountNaira: 1200 },
      { name: 'Beans', quantity: 3, amountNaira: 6600 },
      { name: 'Spaghetti', quantity: 5, amountNaira: 4750 },
      { name: 'Noodles', quantity: 10, amountNaira: 3700 },
      { name: 'Egg', quantity: 30, amountNaira: 7500, displayName: 'Eggs' },
      { name: 'Butter', quantity: 2, amountNaira: 3000 },
      { name: 'Maggi', quantity: 3, amountNaira: 1050 },
      { name: 'Salt', quantity: 2, amountNaira: 500 },
      { name: 'Curry', quantity: 3, amountNaira: 300 },
      { name: 'Thyme', quantity: 3, amountNaira: 300 },
      { name: 'Sachet Tomato', quantity: 10, amountNaira: 1700 },
      { name: 'Semo', quantity: 2, amountNaira: 3100 },
      { name: 'Golden Morn', quantity: 10, amountNaira: 2500, missingFromInventory: true },
      { name: 'Milo Ordinary', quantity: 10, amountNaira: 3000, displayName: 'Milo', priceDiscrepancy: true, inventoryPriceNaira: 180, allocatedPriceNaira: 300 },
      { name: 'Dano Milk', quantity: 10, amountNaira: 1300, missingFromInventory: true },
    ],
  },
  {
    name: 'Affy Party Cooking Starter',
    description: 'A base package for a rice-and-spaghetti party menu.',
    badge: 'Party Cooking',
    priceNaira: 31400,
    status: 'ACTIVE',
    bestFor: 'A base package for a rice-and-spaghetti party menu',
    imageUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80',
    items: [
      { name: 'Rice', quantity: 10, amountNaira: 20000 },
      { name: 'Spaghetti', quantity: 5, amountNaira: 4750 },
      { name: 'Maggi', quantity: 5, amountNaira: 1750 },
      { name: 'Salt', quantity: 2, amountNaira: 500 },
      { name: 'Curry', quantity: 5, amountNaira: 500 },
      { name: 'Thyme', quantity: 5, amountNaira: 500 },
      { name: 'Sachet Tomato', quantity: 20, amountNaira: 3400 },
    ],
  },
];

async function seedBundles() {
  console.log('=== Seeding & Linking Food Bundles in Supabase ===\n');

  // Fetch all products to link items
  const { data: products } = await supabase.from('Product').select('id, name, priceCents, unitId');
  const productMap = {};
  for (const p of products || []) {
    productMap[p.name.trim().toLowerCase()] = p;
  }

  // Fetch all existing packages
  const { data: existingPackages } = await supabase.from('Package').select('*');

  for (const bundle of BUNDLE_DEFINITIONS) {
    console.log(`Processing bundle: "${bundle.name}" (${bundle.status})...`);

    // Check if package already exists
    const existing = (existingPackages || []).find(
      (p) => p.name.trim().toLowerCase() === bundle.name.trim().toLowerCase()
    );

    let packageId;

    if (existing) {
      console.log(`  Updating existing package ID ${existing.id}...`);
      packageId = existing.id;
      await supabase
        .from('Package')
        .update({
          description: bundle.description,
          imageUrl: bundle.imageUrl,
          status: bundle.status,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', packageId);

      // Remove previous package items to re-link fresh
      await supabase.from('PackageItem').delete().eq('packageId', packageId);
    } else {
      packageId = uuidv4();
      console.log(`  Creating new package with ID ${packageId}...`);
      const { data, error } = await supabase
        .from('Package')
        .insert({
          id: packageId,
          name: bundle.name,
          description: bundle.description,
          imageUrl: bundle.imageUrl,
          status: bundle.status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error(`  Error creating package "${bundle.name}":`, error);
        continue;
      }
    }

    // Link items
    let linkedCount = 0;
    let missingCount = 0;

    for (const it of bundle.items) {
      const lookupName = it.name.trim().toLowerCase();
      const matchedProd = productMap[lookupName];

      if (matchedProd) {
        const itemId = uuidv4();
        const { error: piErr } = await supabase.from('PackageItem').insert({
          id: itemId,
          packageId,
          productId: matchedProd.id,
          quantity: it.quantity,
          unitId: matchedProd.unitId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (piErr) {
          console.error(`    Failed to link item "${it.name}":`, piErr.message);
        } else {
          linkedCount++;
        }
      } else {
        missingCount++;
        console.log(`    ⚠️ Item NOT in inventory: "${it.name}" (Qty: ${it.quantity}, Amount: ₦${it.amountNaira.toLocaleString()})`);
      }
    }

    console.log(`  ✅ Bundle "${bundle.name}": ${linkedCount} items linked in Supabase, ${missingCount} missing items flagged.`);
  }

  console.log('\n=== Bundles Seeding Complete ===');
}

seedBundles();
