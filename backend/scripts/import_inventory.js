// backend/scripts/import_inventory.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const UNITS_TO_ENSURE = [
  { name: 'Pack', symbol: 'pack' },
  { name: 'Piece', symbol: 'pcs' },
  { name: 'Sachet', symbol: 'sachet' },
  { name: 'Derica', symbol: 'derica' },
];

const CATEGORIES_TO_ENSURE = [
  { name: 'Grains & Flours', description: 'Rice, garri, beans, and grain products' },
  { name: 'Soup Ingredients', description: 'Maggi, spices, tomato paste, peppers, and condiments' },
  { name: 'Oils & Fats', description: 'Butter, palm oil, and vegetable oil' },
  { name: 'Provisions & Breakfast', description: 'Beverages, eggs, cereals, and dairy items' },
];

const INVENTORY_ITEMS = [
  {
    name: 'Rice',
    price_cents: 200000, // ₦2,000
    category: 'Grains & Flours',
    unit: 'Derica',
    description: 'High-quality stone-free parboiled white rice measured per portion.',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    sku: 'RICE-RET-001',
  },
  {
    name: 'Garri',
    price_cents: 40000, // ₦400
    category: 'Grains & Flours',
    unit: 'Derica',
    description: 'Crisp, sand-free Ijebu white garri with authentic tangy punch.',
    imageUrl: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=800&q=80',
    sku: 'GARRI-RET-002',
  },
  {
    name: 'Beans',
    price_cents: 220000, // ₦2,200
    category: 'Grains & Flours',
    unit: 'Derica',
    description: 'Sweet honey Oloyin fast-cooking brown beans.',
    imageUrl: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&w=800&q=80',
    sku: 'BEANS-RET-003',
  },
  {
    name: 'Spaghetti',
    price_cents: 95000, // ₦950
    category: 'Grains & Flours',
    unit: 'Pack',
    description: '500g premium enriched long durum wheat spaghetti.',
    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?auto=format&fit=crop&w=800&q=80',
    sku: 'SPAG-500G-004',
  },
  {
    name: 'Noodles',
    price_cents: 37000, // ₦370
    category: 'Grains & Flours',
    unit: 'Pack',
    description: 'Instant chicken-flavoured noodle single meal pack.',
    imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=800&q=80',
    sku: 'NOOD-SGL-005',
  },
  {
    name: 'Egg',
    price_cents: 25000, // ₦250
    category: 'Provisions & Breakfast',
    unit: 'Piece',
    description: 'Fresh farm-laid poultry brown egg.',
    imageUrl: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=800&q=80',
    sku: 'EGG-SGL-006',
  },
  {
    name: 'Butter',
    price_cents: 150000, // ₦1,500
    category: 'Oils & Fats',
    unit: 'Pack',
    description: 'Creamy salted cooking & baking margarine butter spread.',
    imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=800&q=80',
    sku: 'BTR-250G-007',
  },
  {
    name: 'Maggi',
    price_cents: 35000, // ₦350
    category: 'Soup Ingredients',
    unit: 'Pack',
    description: 'Classic star seasoning cubes for traditional West African cooking.',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    sku: 'MAGGI-STR-008',
  },
  {
    name: 'Salt',
    price_cents: 25000, // ₦250
    category: 'Soup Ingredients',
    unit: 'Pack',
    description: 'Refined iodized kitchen table salt.',
    imageUrl: 'https://images.unsplash.com/photo-1626197031507-c17099753214?auto=format&fit=crop&w=800&q=80',
    sku: 'SALT-500G-009',
  },
  {
    name: 'Curry',
    price_cents: 10000, // ₦100
    category: 'Soup Ingredients',
    unit: 'Sachet',
    description: 'Aromatic curry spice blend powder for jollof and fried rice.',
    imageUrl: 'https://images.unsplash.com/photo-1596040033282-be23666f272a?auto=format&fit=crop&w=800&q=80',
    sku: 'CURRY-SACH-010',
  },
  {
    name: 'Thyme',
    price_cents: 10000, // ₦100
    category: 'Soup Ingredients',
    unit: 'Sachet',
    description: 'Dried fragrant thyme leaves for meat marinades and stews.',
    imageUrl: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=800&q=80',
    sku: 'THYME-SACH-011',
  },
  {
    name: 'Milo Ordinary',
    price_cents: 18000, // ₦180
    category: 'Provisions & Breakfast',
    unit: 'Sachet',
    description: 'Fortified chocolate malt energy drink single sachet.',
    imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80',
    sku: 'MILO-SACH-012',
  },
  {
    name: 'Chicken Flavor Maggi',
    price_cents: 35000, // ₦350
    category: 'Soup Ingredients',
    unit: 'Pack',
    description: 'Rich chicken flavour bouillon seasoning cubes.',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    sku: 'MAGGI-CHK-013',
  },
  {
    name: 'Sachet Tomato',
    price_cents: 17000, // ₦170
    category: 'Soup Ingredients',
    unit: 'Sachet',
    description: 'Double concentrated thick red tomato and pepper paste sachet.',
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
    sku: 'TOM-SACH-014',
  },
  {
    name: 'Semo',
    price_cents: 155000, // ₦1,550
    category: 'Grains & Flours',
    unit: 'Pack',
    description: 'Smooth milled fortified durum wheat semolina flour.',
    imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
    sku: 'SEMO-1KG-015',
  },
];

async function run() {
  console.log('--- 1. Ensuring Units exist in Supabase ---');
  const unitMap = {};
  const { data: existingUnits } = await supabase.from('Unit').select('*');
  for (const u of existingUnits || []) {
    unitMap[u.name.toLowerCase()] = u.id;
  }

  for (const u of UNITS_TO_ENSURE) {
    if (!unitMap[u.name.toLowerCase()]) {
      const newId = uuidv4();
      const { data, error } = await supabase.from('Unit').insert({
        id: newId,
        name: u.name,
        symbol: u.symbol,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).select().single();
      if (error) {
        console.error('Error inserting unit', u.name, error);
      } else {
        unitMap[u.name.toLowerCase()] = data.id;
        console.log(`Created Unit: ${u.name} (${data.id})`);
      }
    } else {
      console.log(`Unit exists: ${u.name} (${unitMap[u.name.toLowerCase()]})`);
    }
  }

  console.log('\n--- 2. Ensuring Categories exist in Supabase ---');
  const catMap = {};
  const { data: existingCats } = await supabase.from('Category').select('*');
  for (const c of existingCats || []) {
    catMap[c.name.toLowerCase()] = c.id;
  }

  for (const c of CATEGORIES_TO_ENSURE) {
    if (!catMap[c.name.toLowerCase()]) {
      const newId = uuidv4();
      const { data, error } = await supabase.from('Category').insert({
        id: newId,
        name: c.name,
        description: c.description,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).select().single();
      if (error) {
        console.error('Error inserting category', c.name, error);
      } else {
        catMap[c.name.toLowerCase()] = data.id;
        console.log(`Created Category: ${c.name} (${data.id})`);
      }
    } else {
      console.log(`Category exists: ${c.name} (${catMap[c.name.toLowerCase()]})`);
    }
  }

  console.log('\n--- 3. Checking & Importing Inventory Items ---');
  const { data: existingProducts } = await supabase.from('Product').select('*');
  const { data: existingInvs } = await supabase.from('Inventory').select('*');

  const importedOrUpdated = [];

  for (const item of INVENTORY_ITEMS) {
    const existing = (existingProducts || []).find(
      (p) => p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
    );

    const unitId = unitMap[item.unit.toLowerCase()] || existingUnits?.[0]?.id;
    const categoryId = catMap[item.category.toLowerCase()] || existingCats?.[0]?.id;

    if (existing) {
      console.log(`Found existing record for "${item.name}" (ID: ${existing.id}). Updating price to ₦${item.price_cents / 100}...`);
      const { data: updated, error } = await supabase
        .from('Product')
        .update({
          priceCents: item.price_cents,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error(`Failed to update ${item.name}:`, error);
      } else {
        const inv = (existingInvs || []).find((i) => i.productId === existing.id);
        importedOrUpdated.push({
          action: 'UPDATED',
          id: existing.id,
          name: item.name,
          priceNaira: item.price_cents / 100,
          stock: inv ? inv.quantity : 0,
        });
        console.log(`✅ Updated existing: ${item.name} at ₦${item.price_cents / 100} (Preserved stock: ${inv ? inv.quantity : 0})`);
      }
    } else {
      console.log(`No existing record for "${item.name}". Inserting new product...`);
      const newId = uuidv4();
      const { data: inserted, error: insErr } = await supabase
        .from('Product')
        .insert({
          id: newId,
          name: item.name,
          description: item.description,
          sku: item.sku,
          priceCents: item.price_cents,
          currency: 'NGN',
          imageUrl: item.imageUrl,
          unitId,
          categoryId,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (insErr) {
        console.error(`Failed to insert ${item.name}:`, insErr);
      } else {
        // Stock quantity requirement: "Do not invent stock quantities. If new items require stock quantities, leave them unset or at zero according to the existing database rules."
        const invId = uuidv4();
        const { error: invErr } = await supabase.from('Inventory').insert({
          id: invId,
          productId: newId,
          quantity: 0,
          lowStockThreshold: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (invErr) {
          console.error(`Inventory row creation failed for ${item.name}:`, invErr);
        }

        importedOrUpdated.push({
          action: 'IMPORTED',
          id: newId,
          name: item.name,
          priceNaira: item.price_cents / 100,
          stock: 0,
        });
        console.log(`✅ Imported new: ${item.name} at ₦${item.price_cents / 100} (Stock: 0)`);
      }
    }
  }

  console.log('\n--- Summary of Part 1 ---');
  console.table(importedOrUpdated);
}

run();
