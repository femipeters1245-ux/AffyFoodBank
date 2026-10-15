// frontend/src/lib/supabase.ts
// Supabase client — primary source of truth for all product data with resilient offline/initial fallback

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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

export const supabaseProducts = {
  /** List all active products with unit, category, and inventory */
  async list(): Promise<SupabaseProduct[]> {
    if (!isSupabaseConfigured) {
      return getLocalFallbackProducts().filter((p) => p.is_active);
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(
          `
          *,
          unit:units(*),
          category:categories(*),
          inventory:inventories(*)
        `
        )
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Affy Supabase] Query warning:', error.message);
        return getLocalFallbackProducts().filter((p) => p.is_active);
      }
      return data && data.length > 0 ? data : getLocalFallbackProducts().filter((p) => p.is_active);
    } catch (err: any) {
      console.warn('[Affy Supabase] Connection warning:', err.message);
      return getLocalFallbackProducts().filter((p) => p.is_active);
    }
  },

  /** Get all products (including inactive) for admin */
  async listAll(): Promise<SupabaseProduct[]> {
    if (!isSupabaseConfigured) {
      return getLocalFallbackProducts();
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(
          `
          *,
          unit:units(*),
          category:categories(*),
          inventory:inventories(*)
        `
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Affy Supabase] Query warning:', error.message);
        return getLocalFallbackProducts();
      }
      return data && data.length > 0 ? data : getLocalFallbackProducts();
    } catch (err: any) {
      console.warn('[Affy Supabase] Connection warning:', err.message);
      return getLocalFallbackProducts();
    }
  },

  /** Get a single product */
  async getById(id: string): Promise<SupabaseProduct | null> {
    if (!isSupabaseConfigured) {
      return getLocalFallbackProducts().find((p) => p.id === id) ?? null;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(
          `
          *,
          unit:units(*),
          category:categories(*),
          inventory:inventories(*)
        `
        )
        .eq('id', id)
        .single();

      if (error) {
        return getLocalFallbackProducts().find((p) => p.id === id) ?? null;
      }
      return data;
    } catch {
      return getLocalFallbackProducts().find((p) => p.id === id) ?? null;
    }
  },

  /** Create a new product (admin) */
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

    if (!isSupabaseConfigured) {
      const newProd: SupabaseProduct = {
        id: `prod-${Date.now()}`,
        name,
        description: description ?? null,
        sku: `SKU-${Date.now().toString().slice(-6)}`,
        price_cents,
        currency: 'NGN',
        image_url: image_url ?? null,
        unit_id: unit_id ?? null,
        category_id: category_id ?? null,
        is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        inventory: [{ id: `inv-${Date.now()}`, product_id: `prod-${Date.now()}`, quantity: stock, low_stock_threshold: 10, created_at: '', updated_at: '' }],
      };
      const list = getLocalFallbackProducts();
      list.unshift(newProd);
      saveLocalFallbackProducts(list);
      return newProd;
    }

    // Live Supabase creation
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        name,
        description: description ?? null,
        price_cents,
        image_url: image_url ?? null,
        category_id: category_id ?? null,
        unit_id: unit_id ?? null,
        currency: 'NGN',
        is_active,
      })
      .select('*')
      .single();

    if (productError) throw productError;

    // Create inventory record
    const { error: invError } = await supabase.from('inventories').insert({
      product_id: product.id,
      quantity: stock,
      low_stock_threshold: 10,
    });

    if (invError) throw invError;
    return product;
  },

  /** Update an existing product (admin) */
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
    const { stock, ...productFields } = payload;

    if (!isSupabaseConfigured) {
      const list = getLocalFallbackProducts();
      const idx = list.findIndex((p) => p.id === id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          ...productFields,
          inventory: stock !== undefined ? [{ ...list[idx].inventory?.[0]!, quantity: stock, product_id: id, id: 'inv', low_stock_threshold: 10, created_at: '', updated_at: '' }] : list[idx].inventory,
        };
        saveLocalFallbackProducts(list);
        return list[idx];
      }
    }

    // Update product fields in Supabase
    if (Object.keys(productFields).length > 0) {
      const { error } = await supabase.from('products').update(productFields).eq('id', id);
      if (error) throw error;
    }

    // Update inventory if stock provided
    if (stock !== undefined) {
      const { error } = await supabase
        .from('inventories')
        .upsert({ product_id: id, quantity: stock, low_stock_threshold: 10 }, { onConflict: 'product_id' });
      if (error) throw error;
    }

    const updated = await this.getById(id);
    if (!updated) throw new Error('Product not found after update');
    return updated;
  },

  /** Soft-delete a product */
  async deactivate(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const list = getLocalFallbackProducts();
      const p = list.find((item) => item.id === id);
      if (p) p.is_active = false;
      saveLocalFallbackProducts(list);
      return;
    }
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw error;
  },

  /** Hard-delete a product */
  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const list = getLocalFallbackProducts().filter((p) => p.id !== id);
      saveLocalFallbackProducts(list);
      return;
    }
    await supabase.from('inventories').delete().eq('product_id', id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  /** Increment stock */
  async restock(id: string, additionalQty: number): Promise<void> {
    if (!isSupabaseConfigured) {
      const list = getLocalFallbackProducts();
      const p = list.find((item) => item.id === id);
      if (p && p.inventory && p.inventory[0]) {
        p.inventory[0].quantity = Number(p.inventory[0].quantity) + additionalQty;
        saveLocalFallbackProducts(list);
      }
      return;
    }
    const { data: inv } = await supabase.from('inventories').select('quantity').eq('product_id', id).single();
    const current = inv?.quantity ?? 0;
    const { error } = await supabase
      .from('inventories')
      .upsert(
        { product_id: id, quantity: Number(current) + additionalQty, low_stock_threshold: 10 },
        { onConflict: 'product_id' }
      );
    if (error) throw error;
  },
};

// ─── Categories & Units ────────────────────────────────────────────────────────

const FALLBACK_CATEGORIES: SupabaseCategory[] = [
  { id: 'cat-grains', name: 'Grains & Flours', description: null, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-oils', name: 'Oils & Fats', description: null, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-tubers', name: 'Tubers & Roots', description: null, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-soup', name: 'Soup Ingredients', description: null, is_active: true, created_at: '', updated_at: '' },
];

const FALLBACK_UNITS: SupabaseUnit[] = [
  { id: 'unit-bag', name: '50kg Bag', symbol: 'bag', created_at: '', updated_at: '' },
  { id: 'unit-rubber', name: 'Paint Rubber', symbol: 'rubber', created_at: '', updated_at: '' },
  { id: 'unit-keg', name: '25L Keg', symbol: 'keg', created_at: '', updated_at: '' },
  { id: 'unit-bundle', name: 'Bundle (5 Tubers)', symbol: 'bundle', created_at: '', updated_at: '' },
  { id: 'unit-pack', name: 'Bundle Pack', symbol: 'pack', created_at: '', updated_at: '' },
  { id: 'unit-basket', name: 'Farm Basket', symbol: 'basket', created_at: '', updated_at: '' },
  { id: 'unit-bunch', name: 'Bunch (80 Fingers)', symbol: 'bunch', created_at: '', updated_at: '' },
];

export const supabaseCategories = {
  async list(): Promise<SupabaseCategory[]> {
    if (!isSupabaseConfigured) return FALLBACK_CATEGORIES;
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error || !data || data.length === 0) return FALLBACK_CATEGORIES;
      return data;
    } catch {
      return FALLBACK_CATEGORIES;
    }
  },

  async findOrCreate(name: string): Promise<SupabaseCategory> {
    if (!isSupabaseConfigured) {
      return { id: `cat-${Date.now()}`, name, description: null, is_active: true, created_at: '', updated_at: '' };
    }
    const { data: existing } = await supabase.from('categories').select('*').eq('name', name).single();
    if (existing) return existing;

    const { data, error } = await supabase.from('categories').insert({ name, is_active: true }).select('*').single();
    if (error) return { id: `cat-${Date.now()}`, name, description: null, is_active: true, created_at: '', updated_at: '' };
    return data;
  },
};

export const supabaseUnits = {
  async list(): Promise<SupabaseUnit[]> {
    if (!isSupabaseConfigured) return FALLBACK_UNITS;
    try {
      const { data, error } = await supabase.from('units').select('*').order('name');
      if (error || !data || data.length === 0) return FALLBACK_UNITS;
      return data;
    } catch {
      return FALLBACK_UNITS;
    }
  },

  async findOrCreate(name: string, symbol?: string): Promise<SupabaseUnit> {
    if (!isSupabaseConfigured) {
      return { id: `unit-${Date.now()}`, name, symbol: symbol ?? null, created_at: '', updated_at: '' };
    }
    const { data: existing } = await supabase.from('units').select('*').eq('name', name).single();
    if (existing) return existing;

    const { data, error } = await supabase
      .from('units')
      .insert({ name, symbol: symbol ?? null })
      .select('*')
      .single();
    if (error) return { id: `unit-${Date.now()}`, name, symbol: symbol ?? null, created_at: '', updated_at: '' };
    return data;
  },
};
