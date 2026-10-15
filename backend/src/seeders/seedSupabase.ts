// backend/src/seeders/seedSupabase.ts
// Seeds all hardcoded products, categories, and units to Supabase.
// Run with: npx ts-node --transpile-only src/seeders/seedSupabase.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    '❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env\n' +
    '    Please add these from your Supabase project → Settings → API'
  );
  process.exit(1);
}

// Use service role key to bypass RLS for seeding
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ─── Seed Data ────────────────────────────────────────────────────────────────

const UNITS = [
  { name: '50kg Bag',          symbol: 'bag'    },
  { name: 'Paint Rubber',      symbol: 'rubber' },
  { name: '25L Keg',           symbol: 'keg'    },
  { name: 'Bundle (5 Tubers)', symbol: 'bundle' },
  { name: 'Bundle Pack',       symbol: 'pack'   },
  { name: 'Farm Basket',       symbol: 'basket' },
  { name: 'Bunch (80 Fingers)', symbol: 'bunch' },
];

const CATEGORIES = [
  { name: 'Grains & Flours',    description: 'Rice, garri, beans, and grain products' },
  { name: 'Oils & Fats',        description: 'Palm oil, vegetable oil, and cooking fats' },
  { name: 'Tubers & Roots',     description: 'Yam, cassava, cocoyam, and plantain' },
  { name: 'Soup Ingredients',   description: 'Egusi, crayfish, peppers, onions, and condiments' },
];

// Product data with category and unit names for lookup
interface SeedProduct {
  name: string;
  description: string;
  price_cents: number;
  image_url: string;
  category_name: string;
  unit_name: string;
  quantity: number;
  low_stock_threshold: number;
}

const PRODUCTS: SeedProduct[] = [
  {
    name: 'Premium Royal Stallion Rice (50kg Bag)',
    description: 'Long grain, stone-free parboiled Nigerian processed rice. Clean, stone-free, and cooks fluffy without sogginess.',
    price_cents: 7500000,
    image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    category_name: 'Grains & Flours',
    unit_name: '50kg Bag',
    quantity: 140,
    low_stock_threshold: 20,
  },
  {
    name: 'Sweet Honey Oloyin Beans (50kg Bag)',
    description: 'Naturally sweet, fast-cooking unadulterated Nigerian brown beans direct from Niger and Kaduna State harvest.',
    price_cents: 9800000,
    image_url: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&w=800&q=80',
    category_name: 'Grains & Flours',
    unit_name: '50kg Bag',
    quantity: 85,
    low_stock_threshold: 15,
  },
  {
    name: 'Original Ijebu White Garri (Paint Rubber / 4kg)',
    description: 'Crisp, very dry, sand-free with that authentic tangy Ijebu punch. Exceptional for soaking with cold water or eba.',
    price_cents: 450000,
    image_url: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=800&q=80',
    category_name: 'Grains & Flours',
    unit_name: 'Paint Rubber',
    quantity: 320,
    low_stock_threshold: 40,
  },
  {
    name: 'Pure Unadulterated Palm Oil (25L Yellow Keg)',
    description: 'Fresh thick red oil directly from Edo State farm mills. Zero chemical dyes, zero water dilution.',
    price_cents: 3800000,
    image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
    category_name: 'Oils & Fats',
    unit_name: '25L Keg',
    quantity: 45,
    low_stock_threshold: 10,
  },
  {
    name: 'Benue Giant White Yam (Set of 5 Huge Tubers)',
    description: 'High-starch, heavy mature Benue tubers. Yields exceptionally smooth, elastic pounded yam and sweet boiled yam.',
    price_cents: 1650000,
    image_url: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?auto=format&fit=crop&w=800&q=80',
    category_name: 'Tubers & Roots',
    unit_name: 'Bundle (5 Tubers)',
    quantity: 90,
    low_stock_threshold: 15,
  },
  {
    name: 'Hand-Peeled Egusi / Melon Seeds (Paint Rubber)',
    description: 'Machine-sorted, fat, high-oil yield peeled melon seeds for aromatic, rich Nigerian Egusi soup.',
    price_cents: 950000,
    image_url: 'https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?auto=format&fit=crop&w=800&q=80',
    category_name: 'Soup Ingredients',
    unit_name: 'Paint Rubber',
    quantity: 60,
    low_stock_threshold: 10,
  },
  {
    name: 'Refined Vegetable Cooking Oil (25L Keg)',
    description: 'Pure, triple-filtered cholesterol-free vegetable oil for catering, domestic frying, and stew preparation.',
    price_cents: 5200000,
    image_url: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=800&q=80',
    category_name: 'Oils & Fats',
    unit_name: '25L Keg',
    quantity: 50,
    low_stock_threshold: 12,
  },
  {
    name: 'Smoked Catfish & Dried Crayfish Bundle',
    description: 'Kiln-dried Oron crayfish (1kg rubber) combined with 5 large oven-smoked Nigerian catfish.',
    price_cents: 1200000,
    image_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
    category_name: 'Soup Ingredients',
    unit_name: 'Bundle Pack',
    quantity: 35,
    low_stock_threshold: 5,
  },
  {
    name: 'Fresh Scotch Bonnet Pepper & Rodo (Wholesale Basket)',
    description: 'Pungent, hot red scotch bonnet peppers direct from farm harvest. Preserved in aerated wholesale baskets.',
    price_cents: 1450000,
    image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
    category_name: 'Soup Ingredients',
    unit_name: 'Farm Basket',
    quantity: 50,
    low_stock_threshold: 10,
  },
  {
    name: 'Dry Kano Red Onions (Wholesale 50kg Sack)',
    description: 'Hard, thin-skinned pungent red onions with long storage life. Minimum water retention.',
    price_cents: 4200000,
    image_url: 'https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?auto=format&fit=crop&w=800&q=80',
    category_name: 'Soup Ingredients',
    unit_name: '50kg Bag',
    quantity: 40,
    low_stock_threshold: 8,
  },
  {
    name: 'Fresh Cooking Plantain (Stem Bunch / 80 Fingers)',
    description: 'Firm green and semi-ripe plantain bunch from Ondo plantation groves. Ideal for dodo, bole, and plantain flour.',
    price_cents: 1100000,
    image_url: 'https://images.unsplash.com/photo-1603052875302-d376b7c0638a?auto=format&fit=crop&w=800&q=80',
    category_name: 'Tubers & Roots',
    unit_name: 'Bunch (80 Fingers)',
    quantity: 30,
    low_stock_threshold: 5,
  },
  {
    name: 'Yellow Bendel Cassava Garri (50kg Bag)',
    description: 'Rich, palm oil infused fried yellow garri from Delta State. Smooth texture with high density.',
    price_cents: 4600000,
    image_url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
    category_name: 'Grains & Flours',
    unit_name: '50kg Bag',
    quantity: 65,
    low_stock_threshold: 12,
  },
];

// ─── Seed Functions ───────────────────────────────────────────────────────────

async function upsertUnits(): Promise<Record<string, string>> {
  console.log('⚙️  Upserting units...');
  const unitMap: Record<string, string> = {};

  for (const u of UNITS) {
    const { data, error } = await supabase
      .from('units')
      .upsert({ name: u.name, symbol: u.symbol }, { onConflict: 'name' })
      .select('id, name')
      .single();

    if (error) {
      console.error(`  ❌ Failed to upsert unit "${u.name}":`, error.message);
    } else {
      unitMap[data.name] = data.id;
      console.log(`  ✅ Unit: ${data.name} (${data.id})`);
    }
  }
  return unitMap;
}

async function upsertCategories(): Promise<Record<string, string>> {
  console.log('\n⚙️  Upserting categories...');
  const catMap: Record<string, string> = {};

  for (const c of CATEGORIES) {
    const { data, error } = await supabase
      .from('categories')
      .upsert({ name: c.name, description: c.description, is_active: true }, { onConflict: 'name' })
      .select('id, name')
      .single();

    if (error) {
      console.error(`  ❌ Failed to upsert category "${c.name}":`, error.message);
    } else {
      catMap[data.name] = data.id;
      console.log(`  ✅ Category: ${data.name} (${data.id})`);
    }
  }
  return catMap;
}

async function seedProducts(unitMap: Record<string, string>, catMap: Record<string, string>) {
  console.log('\n⚙️  Seeding products...');

  for (const p of PRODUCTS) {
    const unit_id = unitMap[p.unit_name];
    const category_id = catMap[p.category_name];

    if (!unit_id) {
      console.warn(`  ⚠️  Skipping "${p.name}" — unit "${p.unit_name}" not found`);
      continue;
    }
    if (!category_id) {
      console.warn(`  ⚠️  Skipping "${p.name}" — category "${p.category_name}" not found`);
      continue;
    }

    // Check if product already exists by name to avoid duplicates
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('name', p.name)
      .single();

    let productId: string;

    if (existing) {
      // Update existing product
      const { data, error } = await supabase
        .from('products')
        .update({
          description: p.description,
          price_cents: p.price_cents,
          image_url: p.image_url,
          unit_id,
          category_id,
          is_active: true,
        })
        .eq('id', existing.id)
        .select('id, name')
        .single();

      if (error) {
        console.error(`  ❌ Failed to update "${p.name}":`, error.message);
        continue;
      }
      productId = data.id;
      console.log(`  🔄 Updated: ${data.name}`);
    } else {
      // Insert new product
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: p.name,
          description: p.description,
          price_cents: p.price_cents,
          image_url: p.image_url,
          unit_id,
          category_id,
          currency: 'NGN',
          is_active: true,
        })
        .select('id, name')
        .single();

      if (error) {
        console.error(`  ❌ Failed to insert "${p.name}":`, error.message);
        continue;
      }
      productId = data.id;
      console.log(`  ✅ Created: ${data.name}`);
    }

    // Upsert inventory
    const { error: invError } = await supabase
      .from('inventories')
      .upsert(
        {
          product_id: productId,
          quantity: p.quantity,
          low_stock_threshold: p.low_stock_threshold,
        },
        { onConflict: 'product_id' }
      );

    if (invError) {
      console.error(`     ❌ Inventory upsert failed for "${p.name}":`, invError.message);
    } else {
      console.log(`     📦 Inventory: ${p.quantity} units (low stock at ${p.low_stock_threshold})`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Affy FoodBank — Supabase Product Seeder');
  console.log(`📡 Connecting to: ${supabaseUrl}\n`);

  try {
    const unitMap = await upsertUnits();
    const catMap = await upsertCategories();
    await seedProducts(unitMap, catMap);

    console.log('\n✅ Seeding complete! All products are now live in Supabase.');
    console.log('   Open your Supabase dashboard to verify → Table Editor → products\n');
  } catch (err: any) {
    console.error('\n❌ Seeding failed:', err.message ?? err);
    process.exit(1);
  }
}

main();
