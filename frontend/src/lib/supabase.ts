// frontend/src/lib/supabase.ts
// Supabase client — primary source of truth for all product data with resilient offline/initial fallback

import { createClient } from '@supabase/supabase-js';
import { apiClient } from '../services/api';

const supabaseUrl =
  ((import.meta as any).env?.VITE_SUPABASE_URL as string) ||
  'https://jtwrnpqyvypvljgywwau.supabase.co';
const supabaseAnonKey =
  ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0d3JucHF5dnlwdmxqZ3l3d2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0OTI5NTgsImV4cCI6MjEwNzA2ODk1OH0.qUR7nELwgpk5tMYTFGvhrHTUxI3-2_RwP3t--wmB-lw';

// Detect whether valid Supabase cloud credentials are configured
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('YOUR_PROJECT_ID') &&
    !supabaseUrl.includes('placeholder') &&
    supabaseUrl.startsWith('https://')
);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key'
);

// ─── Type helpers ──────────────────────────────────────────────────────────────

export interface SupabaseCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupabaseUnit {
  id: string;
  name: string;
  symbol: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseInventory {
  id: string;
  product_id: string;
  quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface SupabaseProduct {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  unit_id: string | null;
  category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined relations
  unit?: SupabaseUnit | null;
  category?: SupabaseCategory | null;
  inventory?: SupabaseInventory[] | null;
}

// ─── Verified Initial Catalogue (Fallback when cloud Supabase is initializing) ──

export const INITIAL_FALLBACK_PRODUCTS: SupabaseProduct[] = [
  {
    id: 'prod-stallion-rice',
    name: 'Premium Royal Stallion Rice (50kg Bag)',
    description: 'Long grain, stone-free parboiled Nigerian processed rice. Clean, stone-free, and cooks fluffy without sogginess.',
    sku: 'RICE-50KG-001',
    price_cents: 7500000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-bag',
    category_id: 'cat-grains',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-bag', name: '50kg Bag', symbol: 'bag', created_at: '', updated_at: '' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-1', product_id: 'prod-stallion-rice', quantity: 140, low_stock_threshold: 20, created_at: '', updated_at: '' }],
  },
  {
    id: 'prod-oloyin-beans',
    name: 'Sweet Honey Oloyin Beans (50kg Bag)',
    description: 'Naturally sweet, fast-cooking unadulterated Nigerian brown beans direct from Niger and Kaduna State harvest.',
    sku: 'BEANS-50KG-002',
    price_cents: 9800000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-bag',
    category_id: 'cat-grains',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-bag', name: '50kg Bag', symbol: 'bag', created_at: '', updated_at: '' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-2', product_id: 'prod-oloyin-beans', quantity: 85, low_stock_threshold: 15, created_at: '', updated_at: '' }],
  },
  {
    id: 'prod-ijebu-garri',
    name: 'Original Ijebu White Garri (Paint Rubber / 4kg)',
    description: 'Crisp, very dry, sand-free with that authentic tangy Ijebu punch. Exceptional for soaking with cold water or eba.',
    sku: 'GARRI-4KG-003',
    price_cents: 450000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-rubber',
    category_id: 'cat-grains',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-rubber', name: 'Paint Rubber', symbol: 'rubber', created_at: '', updated_at: '' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-3', product_id: 'prod-ijebu-garri', quantity: 320, low_stock_threshold: 40, created_at: '', updated_at: '' }],
  },
  {
    id: 'prod-palm-oil',
    name: 'Pure Unadulterated Palm Oil (25L Yellow Keg)',
    description: 'Fresh thick red oil directly from Edo State farm mills. Zero chemical dyes, zero water dilution.',
    sku: 'OIL-25L-004',
    price_cents: 3800000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-keg',
    category_id: 'cat-oils',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-keg', name: '25L Keg', symbol: 'keg', created_at: '', updated_at: '' },
    category: { id: 'cat-oils', name: 'Oils & Fats', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-4', product_id: 'prod-palm-oil', quantity: 45, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: 'prod-benue-yam',
    name: 'Benue Giant White Yam (Set of 5 Huge Tubers)',
    description: 'High-starch, heavy mature Benue tubers. Yields exceptionally smooth, elastic pounded yam and sweet boiled yam.',
    sku: 'YAM-5TUB-005',
    price_cents: 1650000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-bundle',
    category_id: 'cat-tubers',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-bundle', name: 'Bundle (5 Tubers)', symbol: 'bundle', created_at: '', updated_at: '' },
    category: { id: 'cat-tubers', name: 'Tubers & Roots', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-5', product_id: 'prod-benue-yam', quantity: 90, low_stock_threshold: 15, created_at: '', updated_at: '' }],
  },
  {
    id: 'prod-egusi-seeds',
    name: 'Hand-Peeled Egusi / Melon Seeds (Paint Rubber)',
    description: 'Machine-sorted, fat, high-oil yield peeled melon seeds for aromatic, rich Nigerian Egusi soup.',
    sku: 'EGU-4KG-006',
    price_cents: 950000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-rubber',
    category_id: 'cat-soup',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-rubber', name: 'Paint Rubber', symbol: 'rubber', created_at: '', updated_at: '' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-6', product_id: 'prod-egusi-seeds', quantity: 60, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: 'prod-veg-oil',
    name: 'Refined Vegetable Cooking Oil (25L Keg)',
    description: 'Pure, triple-filtered cholesterol-free vegetable oil for catering, domestic frying, and stew preparation.',
    sku: 'VEG-25L-007',
    price_cents: 5200000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-keg',
    category_id: 'cat-oils',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-keg', name: '25L Keg', symbol: 'keg', created_at: '', updated_at: '' },
    category: { id: 'cat-oils', name: 'Oils & Fats', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-7', product_id: 'prod-veg-oil', quantity: 50, low_stock_threshold: 12, created_at: '', updated_at: '' }],
  },
  {
    id: 'prod-crayfish-catfish',
    name: 'Smoked Catfish & Dried Crayfish Bundle',
    description: 'Kiln-dried Oron crayfish (1kg rubber) combined with 5 large oven-smoked Nigerian catfish.',
    sku: 'CRAY-BDL-008',
    price_cents: 1200000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-pack',
    category_id: 'cat-soup',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-pack', name: 'Bundle Pack', symbol: 'pack', created_at: '', updated_at: '' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-8', product_id: 'prod-crayfish-catfish', quantity: 35, low_stock_threshold: 5, created_at: '', updated_at: '' }],
  },
  {
    id: 'prod-rodo-pepper',
    name: 'Fresh Scotch Bonnet Pepper & Rodo (Wholesale Basket)',
    description: 'Pungent, hot red scotch bonnet peppers direct from farm harvest. Preserved in aerated wholesale baskets.',
    sku: 'RODO-BSK-009',
    price_cents: 1450000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-basket',
    category_id: 'cat-soup',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-basket', name: 'Farm Basket', symbol: 'basket', created_at: '', updated_at: '' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-9', product_id: 'prod-rodo-pepper', quantity: 50, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: 'prod-kano-onions',
    name: 'Dry Kano Red Onions (Wholesale 50kg Sack)',
    description: 'Hard, thin-skinned pungent red onions with long storage life. Minimum water retention.',
    sku: 'ONION-50KG-010',
    price_cents: 4200000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-bag',
    category_id: 'cat-soup',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-bag', name: '50kg Bag', symbol: 'bag', created_at: '', updated_at: '' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-10', product_id: 'prod-kano-onions', quantity: 40, low_stock_threshold: 8, created_at: '', updated_at: '' }],
  },
  {
    id: 'prod-plantain-bunch',
    name: 'Fresh Cooking Plantain (Stem Bunch / 80 Fingers)',
    description: 'Firm green and semi-ripe plantain bunch from Ondo plantation groves. Ideal for dodo, bole, and plantain flour.',
    sku: 'PLANT-BNCH-011',
    price_cents: 1100000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1603052875302-d376b7c0638a?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-bunch',
    category_id: 'cat-tubers',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-bunch', name: 'Bunch (80 Fingers)', symbol: 'bunch', created_at: '', updated_at: '' },
    category: { id: 'cat-tubers', name: 'Tubers & Roots', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-11', product_id: 'prod-plantain-bunch', quantity: 30, low_stock_threshold: 5, created_at: '', updated_at: '' }],
  },
  {
    id: 'prod-yellow-garri',
    name: 'Yellow Bendel Cassava Garri (50kg Bag)',
    description: 'Rich, palm oil infused fried yellow garri from Delta State. Smooth texture with high density.',
    sku: 'YGARRI-50KG-012',
    price_cents: 4600000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-bag',
    category_id: 'cat-grains',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unit: { id: 'unit-bag', name: '50kg Bag', symbol: 'bag', created_at: '', updated_at: '' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-12', product_id: 'prod-yellow-garri', quantity: 65, low_stock_threshold: 12, created_at: '', updated_at: '' }],
  },
  {
    id: 'df912956-2067-4471-876a-50588d84bea6',
    name: 'Rice',
    description: 'High-quality stone-free parboiled white rice measured per portion.',
    sku: 'RICE-RET-001',
    price_cents: 200000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-derica',
    category_id: 'cat-grains',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-derica', name: 'Derica', symbol: 'derica', created_at: '', updated_at: '' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-rice', product_id: 'df912956-2067-4471-876a-50588d84bea6', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: 'e0a46d6a-22de-4cc0-a18f-58150ba84e3d',
    name: 'Garri',
    description: 'Crisp, sand-free Ijebu white garri with authentic tangy punch.',
    sku: 'GARRI-RET-002',
    price_cents: 40000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-derica',
    category_id: 'cat-grains',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-derica', name: 'Derica', symbol: 'derica', created_at: '', updated_at: '' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-garri', product_id: 'e0a46d6a-22de-4cc0-a18f-58150ba84e3d', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: '1316321b-c828-4623-a1f7-45aff8f2f4e3',
    name: 'Beans',
    description: 'Sweet honey Oloyin fast-cooking brown beans.',
    sku: 'BEANS-RET-003',
    price_cents: 220000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-derica',
    category_id: 'cat-grains',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-derica', name: 'Derica', symbol: 'derica', created_at: '', updated_at: '' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-beans', product_id: '1316321b-c828-4623-a1f7-45aff8f2f4e3', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: 'bd8659e2-3f1f-4161-8ad8-f44176fa5530',
    name: 'Spaghetti',
    description: '500g premium enriched long durum wheat spaghetti.',
    sku: 'SPAG-500G-004',
    price_cents: 95000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-pack',
    category_id: 'cat-grains',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-pack', name: 'Pack', symbol: 'pack', created_at: '', updated_at: '' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-spag', product_id: 'bd8659e2-3f1f-4161-8ad8-f44176fa5530', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: 'fc7872e0-2f5d-4cbf-9e68-da7c9fc2fab1',
    name: 'Noodles',
    description: 'Instant chicken-flavoured noodle single meal pack.',
    sku: 'NOOD-SGL-005',
    price_cents: 37000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-pack',
    category_id: 'cat-grains',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-pack', name: 'Pack', symbol: 'pack', created_at: '', updated_at: '' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-nood', product_id: 'fc7872e0-2f5d-4cbf-9e68-da7c9fc2fab1', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: '900896cf-7867-4894-9fba-d39261527c1e',
    name: 'Egg',
    description: 'Fresh farm-laid poultry brown egg.',
    sku: 'EGG-SGL-006',
    price_cents: 25000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-pcs',
    category_id: 'cat-prov',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-pcs', name: 'Piece', symbol: 'pcs', created_at: '', updated_at: '' },
    category: { id: 'cat-prov', name: 'Provisions & Breakfast', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-egg', product_id: '900896cf-7867-4894-9fba-d39261527c1e', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: '7218cfd0-c320-40e8-b835-70450f16ddc6',
    name: 'Butter',
    description: 'Creamy salted cooking & baking margarine butter spread.',
    sku: 'BTR-250G-007',
    price_cents: 150000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-pack',
    category_id: 'cat-oils',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-pack', name: 'Pack', symbol: 'pack', created_at: '', updated_at: '' },
    category: { id: 'cat-oils', name: 'Oils & Fats', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-btr', product_id: '7218cfd0-c320-40e8-b835-70450f16ddc6', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: '5aadd6d7-1a61-4740-b8f6-99d07e15e8a4',
    name: 'Maggi',
    description: 'Classic star seasoning cubes for traditional West African cooking.',
    sku: 'MAGGI-STR-008',
    price_cents: 35000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-pack',
    category_id: 'cat-soup',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-pack', name: 'Pack', symbol: 'pack', created_at: '', updated_at: '' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-maggi', product_id: '5aadd6d7-1a61-4740-b8f6-99d07e15e8a4', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: '2627f89d-5f18-461a-a54b-678536760d15',
    name: 'Salt',
    description: 'Refined iodized kitchen table salt.',
    sku: 'SALT-500G-009',
    price_cents: 25000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1626197031507-c17099753214?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-pack',
    category_id: 'cat-soup',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-pack', name: 'Pack', symbol: 'pack', created_at: '', updated_at: '' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-salt', product_id: '2627f89d-5f18-461a-a54b-678536760d15', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: '2cf5c1dc-0e63-4d62-8e49-85dac080cfae',
    name: 'Curry',
    description: 'Aromatic curry spice blend powder for jollof and fried rice.',
    sku: 'CURRY-SACH-010',
    price_cents: 10000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1596040033282-be23666f272a?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-sachet',
    category_id: 'cat-soup',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-sachet', name: 'Sachet', symbol: 'sachet', created_at: '', updated_at: '' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-curry', product_id: '2cf5c1dc-0e63-4d62-8e49-85dac080cfae', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: '45838585-51c4-46e7-b7a3-80041fb706ac',
    name: 'Thyme',
    description: 'Dried fragrant thyme leaves for meat marinades and stews.',
    sku: 'THYME-SACH-011',
    price_cents: 10000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-sachet',
    category_id: 'cat-soup',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-sachet', name: 'Sachet', symbol: 'sachet', created_at: '', updated_at: '' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-thyme', product_id: '45838585-51c4-46e7-b7a3-80041fb706ac', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: 'df1d1155-fd53-4590-adca-72a00a1eeca3',
    name: 'Milo Ordinary',
    description: 'Fortified chocolate malt energy drink single sachet.',
    sku: 'MILO-SACH-012',
    price_cents: 18000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-sachet',
    category_id: 'cat-prov',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-sachet', name: 'Sachet', symbol: 'sachet', created_at: '', updated_at: '' },
    category: { id: 'cat-prov', name: 'Provisions & Breakfast', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-milo', product_id: 'df1d1155-fd53-4590-adca-72a00a1eeca3', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: '95673474-e64b-4834-a461-d5246a8ceb66',
    name: 'Chicken Flavor Maggi',
    description: 'Rich chicken flavour bouillon seasoning cubes.',
    sku: 'MAGGI-CHK-013',
    price_cents: 35000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-pack',
    category_id: 'cat-soup',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-pack', name: 'Pack', symbol: 'pack', created_at: '', updated_at: '' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-chkmaggi', product_id: '95673474-e64b-4834-a461-d5246a8ceb66', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: 'b1aded4b-b746-4621-99a7-c913d0d09805',
    name: 'Sachet Tomato',
    description: 'Double concentrated thick red tomato and pepper paste sachet.',
    sku: 'TOM-SACH-014',
    price_cents: 17000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-sachet',
    category_id: 'cat-soup',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-sachet', name: 'Sachet', symbol: 'sachet', created_at: '', updated_at: '' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-tom', product_id: 'b1aded4b-b746-4621-99a7-c913d0d09805', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
  {
    id: 'df9cdcfd-e29d-4417-b9ff-ae14009a5a24',
    name: 'Semo',
    description: 'Smooth milled fortified durum wheat semolina flour.',
    sku: 'SEMO-1KG-015',
    price_cents: 155000,
    currency: 'NGN',
    image_url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
    unit_id: 'unit-pack',
    category_id: 'cat-grains',
    is_active: true,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    unit: { id: 'unit-pack', name: 'Pack', symbol: 'pack', created_at: '', updated_at: '' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
    inventory: [{ id: 'inv-ret-semo', product_id: 'df9cdcfd-e29d-4417-b9ff-ae14009a5a24', quantity: 0, low_stock_threshold: 10, created_at: '', updated_at: '' }],
  },
];

// Helper to get local storage fallback items if edited in admin while offline
function getLocalFallbackProducts(): SupabaseProduct[] {
  try {
    const saved = localStorage.getItem('affy_fallback_products');
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_FALLBACK_PRODUCTS;
}

function saveLocalFallbackProducts(items: SupabaseProduct[]) {
  try {
    localStorage.setItem('affy_fallback_products', JSON.stringify(items));
  } catch {}
}

// ─── Products API ──────────────────────────────────────────────────────────────

function normalizeProductFromDb(p: any): SupabaseProduct {
  const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    sku: p.sku ?? null,
    price_cents: Number(p.priceCents ?? p.price_cents ?? 0),
    currency: p.currency || 'NGN',
    image_url: p.imageUrl ?? p.image_url ?? null,
    unit_id: p.unitId ?? p.unit_id ?? null,
    category_id: p.categoryId ?? p.category_id ?? null,
    is_active: p.isActive ?? p.is_active ?? true,
    created_at: p.createdAt ?? p.created_at ?? new Date().toISOString(),
    updated_at: p.updatedAt ?? p.updated_at ?? new Date().toISOString(),
    unit: p.unit
      ? {
          id: p.unit.id,
          name: p.unit.name,
          symbol: p.unit.symbol ?? null,
          created_at: p.unit.createdAt ?? p.unit.created_at ?? '',
          updated_at: p.unit.updatedAt ?? p.unit.updated_at ?? '',
        }
      : null,
    category: p.category
      ? {
          id: p.category.id,
          name: p.category.name,
          description: p.category.description ?? null,
          is_active: p.category.isActive ?? p.category.is_active ?? true,
          created_at: p.category.createdAt ?? p.category.created_at ?? '',
          updated_at: p.category.updatedAt ?? p.category.updated_at ?? '',
        }
      : null,
    inventory: inv
      ? [
          {
            id: inv.id || `inv-${p.id}`,
            product_id: p.id,
            quantity: Number(inv.quantity ?? 0),
            low_stock_threshold: Number(inv.lowStockThreshold ?? inv.low_stock_threshold ?? 10),
            created_at: inv.createdAt ?? inv.created_at ?? '',
            updated_at: inv.updatedAt ?? inv.updated_at ?? '',
          },
        ]
      : [],
  };
}

export const supabaseProducts = {
  /** List all active products — always fetches fresh from Supabase via backend */
  async list(): Promise<SupabaseProduct[]> {
    try {
      const res = await apiClient.get<any>('/products', { params: { limit: 100 } });
      const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      if (items.length > 0) {
        const normalized = items.map(normalizeProductFromDb).filter((p: SupabaseProduct) => p.is_active);
        // Replace (not merge) the localStorage cache with the fresh server data
        try { localStorage.removeItem('affy_fallback_products'); } catch {}
        saveLocalFallbackProducts(normalized);
        return normalized;
      }
    } catch (err: any) {
      console.warn('[System Inventory Engine] Products query fallback:', err.message);
    }

    return getLocalFallbackProducts().filter((p) => p.is_active);
  },

  /** Get all products (including inactive) for admin inventory control — always fetches fresh */
  async listAll(): Promise<SupabaseProduct[]> {
    try {
      const res = await apiClient.get<any>('/admin/products');
      const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      if (items.length > 0) {
        const normalized = items.map(normalizeProductFromDb);
        // Replace (not merge) the localStorage cache with fresh data from Supabase
        try { localStorage.removeItem('affy_fallback_products'); } catch {}
        saveLocalFallbackProducts(normalized);
        return normalized;
      }
    } catch {}

    try {
      const res = await apiClient.get<any>('/products', { params: { limit: 100 } });
      const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      if (items.length > 0) {
        const normalized = items.map(normalizeProductFromDb);
        try { localStorage.removeItem('affy_fallback_products'); } catch {}
        saveLocalFallbackProducts(normalized);
        return normalized;
      }
    } catch (err: any) {
      console.warn('[System Inventory Engine] Admin products query warning:', err.message);
    }

    return getLocalFallbackProducts();
  },

  /** Get a single product */
  async getById(id: string): Promise<SupabaseProduct | null> {
    try {
      const res = await apiClient.get(`/products/${id}`);
      if (res.data) return normalizeProductFromDb(res.data);
    } catch {}
    return getLocalFallbackProducts().find((p) => p.id === id) ?? null;
  },

  /** Create a new product in system store */
  async create(payload: {
    name: string;
    description?: string;
    price_cents: number;
    image_url?: string;
    category_id?: string;
    unit_id?: string;
    stock?: number;
    is_active?: boolean;
  }): Promise<SupabaseProduct> {
    const { name, description, price_cents, image_url, category_id, unit_id, stock = 0, is_active = true } = payload;

    try {
      const res = await apiClient.post('/admin/products', {
        name,
        description,
        priceCents: price_cents,
        imageUrl: image_url,
        stock,
        categoryId: category_id,
        unitId: unit_id,
        isActive: is_active,
      });
      if (res.data) {
        const p = normalizeProductFromDb(res.data);
        const list = getLocalFallbackProducts();
        list.unshift(p);
        saveLocalFallbackProducts(list);
        window.dispatchEvent(new CustomEvent('affy_inventory_updated', { detail: p }));
        return p;
      }
    } catch (err: any) {
      console.warn('[System Inventory Engine] Create product API failed, saving locally:', err.message);
    }

    const newProd = normalizeProductFromDb({
      id: `prod-${Date.now()}`,
      name,
      description,
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      priceCents: price_cents,
      imageUrl: image_url,
      unitId: unit_id,
      categoryId: category_id,
      isActive: is_active,
      inventory: { quantity: stock },
    });
    const list = getLocalFallbackProducts();
    list.unshift(newProd);
    saveLocalFallbackProducts(list);
    window.dispatchEvent(new CustomEvent('affy_inventory_updated', { detail: newProd }));
    return newProd;
  },

  /** Update an existing product and push edits immediately */
  async update(
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      price_cents: number;
      image_url: string;
      category_id: string;
      unit_id: string;
      is_active: boolean;
      stock: number;
    }>
  ): Promise<SupabaseProduct> {
    const res = await apiClient.put(`/admin/products/${id}`, {
      name: payload.name,
      description: payload.description,
      priceCents: payload.price_cents,
      imageUrl: payload.image_url,
      stock: payload.stock,
      categoryId: payload.category_id,
      unitId: payload.unit_id,
      isActive: payload.is_active,
    });

    if (res.data) {
      const updated = normalizeProductFromDb(res.data);
      // Invalidate the localStorage cache so the next list() re-fetches fresh data
      try { localStorage.removeItem('affy_fallback_products'); } catch {}
      // Notify the Marketplace to reload its product list
      window.dispatchEvent(new CustomEvent('affy_inventory_updated', { detail: updated }));
      return updated;
    }

    throw new Error('Update returned no data from server');
  },

  /** Increment stock */
  async restock(id: string, additionalQty: number): Promise<void> {
    try {
      await apiClient.post(`/admin/products/${id}/restock`, { amount: additionalQty });
    } catch {}
    const prod = await this.getById(id);
    const current = Number(prod?.inventory?.[0]?.quantity ?? 0);
    await this.update(id, { stock: current + additionalQty });
  },

  /** Soft-delete a product */
  async deactivate(id: string): Promise<void> {
    await this.update(id, { is_active: false });
  },

  /** Hard-delete a product */
  async delete(id: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/products/${id}`);
    } catch {}
    const list = getLocalFallbackProducts().filter((p) => p.id !== id);
    saveLocalFallbackProducts(list);
    window.dispatchEvent(new CustomEvent('affy_inventory_updated', { detail: { id, deleted: true } }));
  },
};

// ─── Categories & Units ────────────────────────────────────────────────────────

const FALLBACK_CATEGORIES: SupabaseCategory[] = [
  { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-oils', name: 'Oils & Fats', description: null, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-tubers', name: 'Tubers & Roots', description: null, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-prov', name: 'Provisions & Breakfast', description: null, is_active: true, created_at: '', updated_at: '' },
];

const FALLBACK_UNITS: SupabaseUnit[] = [
  { id: 'unit-bag', name: '50kg Bag', symbol: 'bag', created_at: '', updated_at: '' },
  { id: 'unit-rubber', name: 'Paint Rubber', symbol: 'rubber', created_at: '', updated_at: '' },
  { id: 'unit-keg', name: '25L Keg', symbol: 'keg', created_at: '', updated_at: '' },
  { id: 'unit-bundle', name: 'Bundle (5 Tubers)', symbol: 'bundle', created_at: '', updated_at: '' },
  { id: 'unit-pack', name: 'Pack', symbol: 'pack', created_at: '', updated_at: '' },
  { id: 'unit-basket', name: 'Farm Basket', symbol: 'basket', created_at: '', updated_at: '' },
  { id: 'unit-bunch', name: 'Bunch (80 Fingers)', symbol: 'bunch', created_at: '', updated_at: '' },
  { id: 'unit-pcs', name: 'Piece', symbol: 'pcs', created_at: '', updated_at: '' },
  { id: 'unit-sachet', name: 'Sachet', symbol: 'sachet', created_at: '', updated_at: '' },
  { id: 'unit-derica', name: 'Derica', symbol: 'derica', created_at: '', updated_at: '' },
];

export const supabaseCategories = {
  async list(): Promise<SupabaseCategory[]> {
    return FALLBACK_CATEGORIES;
  },

  async findOrCreate(name: string): Promise<SupabaseCategory> {
    const existing = FALLBACK_CATEGORIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    return { id: `cat-${Date.now()}`, name, description: null, is_active: true, created_at: '', updated_at: '' };
  },
};

export const supabaseUnits = {
  async list(): Promise<SupabaseUnit[]> {
    return FALLBACK_UNITS;
  },

  async findOrCreate(name: string, symbol?: string): Promise<SupabaseUnit> {
    const existing = FALLBACK_UNITS.find((u) => u.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    return { id: `unit-${Date.now()}`, name, symbol: symbol ?? null, created_at: '', updated_at: '' };
  },
};

// ─── Packages & Bundles Service ────────────────────────────────────────────────
export interface SupabasePackageItem {
  id?: string;
  name: string;
  displayName?: string;
  quantity: number;
  unit?: { id: string; name: string; symbol: string | null };
  product?: { id: string; name: string; priceCents: number; sku?: string; imageUrl?: string | null; isActive?: boolean };
  amountCents: number;
  missingFromInventory?: boolean;
  unavailableFromInventory?: boolean;
  priceDiscrepancy?: boolean;
  inventoryPriceCents?: number;
  allocatedPriceCents?: number;
}

export interface SupabasePackage {
  id: string;
  name: string;
  description: string;
  badge: string;
  imageUrl: string;
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  priceCents: number;
  originalPriceCents: number;
  savingsPercentage: number;
  bestFor: string;
  items: SupabasePackageItem[];
  missingItems?: string[];
  unavailableItems?: string[];
  priceDiscrepancies?: Array<{
    item: string;
    inventoryPriceNaira: number;
    allocatedPriceNaira: number;
    message: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export const INITIAL_FALLBACK_PACKAGES: SupabasePackage[] = [
  {
    id: '8556e5fd-1440-4874-b2b8-b9d2a1157159',
    name: 'Affy Student Essentials',
    description: 'An affordable mix of staples and quick meals.',
    badge: 'Budget Student Essential',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE',
    priceCents: 1153000, // ₦11,530
    originalPriceCents: 1350000,
    savingsPercentage: 15,
    bestFor: 'Students & singles needing reliable weekly staple groceries',
    items: [
      { name: 'Rice', quantity: 1, amountCents: 200000 },
      { name: 'Garri', quantity: 2, amountCents: 80000 },
      { name: 'Beans', quantity: 1, amountCents: 220000 },
      { name: 'Spaghetti', quantity: 2, amountCents: 190000 },
      { name: 'Noodles', quantity: 5, amountCents: 185000 },
      { name: 'Egg', displayName: 'Eggs', quantity: 6, amountCents: 150000 },
      { name: 'Maggi', quantity: 1, amountCents: 35000 },
      { name: 'Salt', quantity: 1, amountCents: 25000 },
      { name: 'Sachet Tomato', quantity: 4, amountCents: 68000 },
    ],
  },
  {
    id: '1ed4a86e-a795-47b4-a68c-68947f4c6da4',
    name: 'Affy Solo Living Package',
    description: 'For bachelors and spinsters who want variety for everyday cooking.',
    badge: 'Solo Living',
    imageUrl: 'https://images.unsplash.com/photo-1506484381205-f7945653044d?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE',
    priceCents: 1807000, // ₦18,070 (Sardines removed — not in inventory)
    originalPriceCents: 2350000,
    savingsPercentage: 15,
    bestFor: 'Bachelors and spinsters who want variety for everyday cooking',
    items: [
      { name: 'Rice', quantity: 2, amountCents: 400000 },
      { name: 'Garri', quantity: 2, amountCents: 80000 },
      { name: 'Beans', quantity: 1, amountCents: 220000 },
      { name: 'Spaghetti', quantity: 3, amountCents: 285000 },
      { name: 'Noodles', quantity: 5, amountCents: 185000 },
      { name: 'Egg', displayName: 'Eggs', quantity: 10, amountCents: 250000 },
      { name: 'Butter', quantity: 1, amountCents: 150000 },
      { name: 'Maggi', quantity: 2, amountCents: 70000 },
      { name: 'Salt', quantity: 1, amountCents: 25000 },
      { name: 'Curry', quantity: 2, amountCents: 20000 },
      { name: 'Thyme', quantity: 2, amountCents: 20000 },
      { name: 'Sachet Tomato', quantity: 6, amountCents: 102000 },
    ],
  },
  {
    id: '450521bd-6cd8-40ca-9831-f495ad82df5b',
    name: 'Affy Family & Kids Package',
    description: 'Household staples with breakfast options for the children.',
    badge: 'Family & Kids Package',
    imageUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE',
    priceCents: 4480000, // ₦44,800 (Golden Morn & Dano Milk removed; Milo at live ₦180×10=₦1,800)
    originalPriceCents: 5800000,
    savingsPercentage: 13,
    bestFor: 'Household staples with breakfast options for the children',
    items: [
      { name: 'Rice', quantity: 5, amountCents: 1000000 },
      { name: 'Garri', quantity: 3, amountCents: 120000 },
      { name: 'Beans', quantity: 3, amountCents: 660000 },
      { name: 'Spaghetti', quantity: 5, amountCents: 475000 },
      { name: 'Noodles', quantity: 10, amountCents: 370000 },
      { name: 'Egg', displayName: 'Eggs', quantity: 30, amountCents: 750000 },
      { name: 'Butter', quantity: 2, amountCents: 300000 },
      { name: 'Maggi', quantity: 3, amountCents: 105000 },
      { name: 'Salt', quantity: 2, amountCents: 50000 },
      { name: 'Curry', quantity: 3, amountCents: 30000 },
      { name: 'Thyme', quantity: 3, amountCents: 30000 },
      { name: 'Sachet Tomato', quantity: 10, amountCents: 170000 },
      { name: 'Semo', quantity: 2, amountCents: 310000 },
      { name: 'Milo Ordinary', displayName: 'Milo', quantity: 10, amountCents: 180000 },
    ],
  },
  {
    id: 'd3f0df28-b8e6-4e1c-8c4e-375a0ab9f2e4',
    name: 'Affy Party Cooking Starter',
    description: 'A base package for a rice-and-spaghetti party menu.',
    badge: 'Party Starter',
    imageUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE',
    priceCents: 3140000, // ₦31,400
    originalPriceCents: 3600000,
    savingsPercentage: 13,
    bestFor: 'A base package for a rice-and-spaghetti party menu',
    items: [
      { name: 'Rice', quantity: 10, amountCents: 2000000 },
      { name: 'Spaghetti', quantity: 5, amountCents: 475000 },
      { name: 'Maggi', quantity: 5, amountCents: 175000 },
      { name: 'Salt', quantity: 2, amountCents: 50000 },
      { name: 'Curry', quantity: 5, amountCents: 50000 },
      { name: 'Thyme', quantity: 5, amountCents: 50000 },
      { name: 'Sachet Tomato', quantity: 20, amountCents: 340000 },
    ],
  },
];

function getLocalFallbackPackages(): SupabasePackage[] {
  try {
    const saved = localStorage.getItem('affy_fallback_packages');
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_FALLBACK_PACKAGES;
}

function saveLocalFallbackPackages(items: SupabasePackage[]) {
  try {
    localStorage.setItem('affy_fallback_packages', JSON.stringify(items));
  } catch {}
}

export const supabasePackages = {
  /** List all packages (active & drafts for operational control, always fresh) */
  async listAll(): Promise<SupabasePackage[]> {
    try {
      const res = await apiClient.get<any>('/admin/packages');
      if (Array.isArray(res.data) && res.data.length > 0) {
        saveLocalFallbackPackages(res.data);
        return res.data;
      }
    } catch {}

    try {
      const res = await apiClient.get<any>('/packages');
      if (Array.isArray(res.data) && res.data.length > 0) {
        saveLocalFallbackPackages(res.data);
        return res.data;
      }
    } catch {}

    return getLocalFallbackPackages();
  },

  /** List active published packages for public customer page */
  async list(): Promise<SupabasePackage[]> {
    const all = await this.listAll();
    return all;
  },

  /** Get package by ID */
  async getById(id: string): Promise<SupabasePackage | null> {
    const all = await this.listAll();
    return all.find((p) => p.id === id) || null;
  },

  /** Update package metadata */
  async update(
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      imageUrl: string;
      badge: string;
      status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
      priceCents: number;
    }>
  ): Promise<SupabasePackage> {
    try {
      const res = await apiClient.put(`/admin/packages/${id}`, payload);
      if (res.data) {
        const list = getLocalFallbackPackages().map((p) => (p.id === id ? { ...p, ...res.data } : p));
        saveLocalFallbackPackages(list);
        window.dispatchEvent(new CustomEvent('affy_packages_updated', { detail: res.data }));
        return res.data;
      }
    } catch {}

    const list = getLocalFallbackPackages();
    const idx = list.findIndex((p) => p.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...payload, updatedAt: new Date().toISOString() };
      saveLocalFallbackPackages(list);
      window.dispatchEvent(new CustomEvent('affy_packages_updated', { detail: list[idx] }));
      return list[idx];
    }
    throw new Error('Package not found');
  },

  /**
   * Replace all PackageItems for a bundle.
   * The backend recalculates the price from live inventory priceCents.
   * items: [{ productId, quantity }]
   */
  async updateItems(
    id: string,
    items: { productId: string; quantity: number }[]
  ): Promise<SupabasePackage> {
    const res = await apiClient.put(`/admin/packages/${id}/items`, { items });
    const updated = res.data as SupabasePackage;
    const list = getLocalFallbackPackages().map((p) => (p.id === id ? { ...p, ...updated } : p));
    saveLocalFallbackPackages(list);
    window.dispatchEvent(new CustomEvent('affy_packages_updated', { detail: updated }));
    return updated;
  },

  /** Create package */
  async create(payload: Partial<SupabasePackage>): Promise<SupabasePackage> {
    try {
      const res = await apiClient.post('/admin/packages', payload);
      if (res.data) {
        const list = getLocalFallbackPackages();
        list.push(res.data);
        saveLocalFallbackPackages(list);
        window.dispatchEvent(new CustomEvent('affy_packages_updated', { detail: res.data }));
        return res.data;
      }
    } catch {}

    const newPkg: SupabasePackage = {
      id: `pkg-${Date.now()}`,
      name: payload.name || 'Custom Bundle',
      description: payload.description || '',
      badge: payload.badge || 'Curated Bundle',
      imageUrl: payload.imageUrl || '',
      status: payload.status || 'DRAFT',
      priceCents: payload.priceCents || 0,
      originalPriceCents: payload.originalPriceCents || 0,
      savingsPercentage: payload.savingsPercentage || 14,
      bestFor: payload.bestFor || 'Families and bulk buyers',
      items: payload.items || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const list = getLocalFallbackPackages();
    list.push(newPkg);
    saveLocalFallbackPackages(list);
    window.dispatchEvent(new CustomEvent('affy_packages_updated', { detail: newPkg }));
    return newPkg;
  },

  /** Deactivate package */
  async deactivate(id: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/packages/${id}`);
    } catch {}
    const list = getLocalFallbackPackages().map((p) => (p.id === id ? { ...p, status: 'INACTIVE' as const } : p));
    saveLocalFallbackPackages(list);
    window.dispatchEvent(new CustomEvent('affy_packages_updated', { detail: { id, status: 'INACTIVE' } }));
  },
};


