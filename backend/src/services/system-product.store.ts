// backend/src/services/system-product.store.ts
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { supabaseAdmin } from './supabase-admin.service';

export interface SystemProduct {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  unitId: string | null;
  categoryId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  unit?: {
    id: string;
    name: string;
    symbol: string | null;
  } | null;
  category?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  inventory?: Array<{
    id: string;
    productId: string;
    quantity: number;
    lowStockThreshold: number;
  }> | null;
}

const INITIAL_CATALOG: SystemProduct[] = [
  {
    id: 'prod-001',
    name: 'Premium Royal Stallion Rice (50kg Bag)',
    description: 'Long grain, stone-free parboiled Nigerian processed rice. Clean, swell-friendly, and premium grade.',
    sku: 'RICE-50KG-001',
    priceCents: 7500000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-bag',
    categoryId: 'cat-grains',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-bag', name: '50kg Bag', symbol: 'bag' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null },
    inventory: [{ id: 'inv-1', productId: 'prod-001', quantity: 140, lowStockThreshold: 15 }],
  },
  {
    id: 'prod-002',
    name: 'Sweet Honey Oloyin Beans (50kg Bag)',
    description: 'Naturally sweet, fast-cooking unadulterated Nigerian brown beans directly from Maiduguri farms.',
    sku: 'BEANS-50KG-002',
    priceCents: 9800000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-bag',
    categoryId: 'cat-grains',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-bag', name: '50kg Bag', symbol: 'bag' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null },
    inventory: [{ id: 'inv-2', productId: 'prod-002', quantity: 85, lowStockThreshold: 10 }],
  },
  {
    id: 'prod-003',
    name: 'Original Ijebu White Garri (Paint Rubber / 4kg)',
    description: 'Crisp, very dry, sand-free with authentic tangy Ijebu punch. Fermented and fried to golden crispness.',
    sku: 'GARRI-RUB-003',
    priceCents: 450000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-rubber',
    categoryId: 'cat-grains',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-rubber', name: 'Paint Rubber', symbol: 'rubber' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null },
    inventory: [{ id: 'inv-3', productId: 'prod-003', quantity: 320, lowStockThreshold: 30 }],
  },
  {
    id: 'prod-004',
    name: 'Pure Unadulterated Palm Oil (25L Yellow Keg)',
    description: 'Fresh thick red oil directly from Edo State farm mills. Zero additives, zero coloring.',
    sku: 'PALM-25L-004',
    priceCents: 3800000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-keg',
    categoryId: 'cat-oils',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-keg', name: '25L Keg', symbol: 'keg' },
    category: { id: 'cat-oils', name: 'Oils & Fats', description: null },
    inventory: [{ id: 'inv-4', productId: 'prod-004', quantity: 14, lowStockThreshold: 10 }],
  },
  {
    id: 'prod-005',
    name: 'Benue Giant White Yam (Set of 5 Huge Tubers)',
    description: 'High-starch, heavy mature Benue tubers. Fluffy when boiled and stretchy for pounded yam.',
    sku: 'YAM-5TUB-005',
    priceCents: 1650000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-bundle',
    categoryId: 'cat-tubers',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-bundle', name: 'Bundle (5 Tubers)', symbol: 'bundle' },
    category: { id: 'cat-tubers', name: 'Tubers & Roots', description: null },
    inventory: [{ id: 'inv-5', productId: 'prod-005', quantity: 65, lowStockThreshold: 10 }],
  },
  {
    id: 'prod-006',
    name: 'Hand-Peeled Egusi / Melon Seeds (Paint Rubber)',
    description: 'Machine-sorted, fat, high-oil yield peeled melon seeds. Ideal for rich traditional Nigerian soups.',
    sku: 'EGUSI-RUB-006',
    priceCents: 950000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-rubber',
    categoryId: 'cat-soup',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-rubber', name: 'Paint Rubber', symbol: 'rubber' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null },
    inventory: [{ id: 'inv-6', productId: 'prod-006', quantity: 60, lowStockThreshold: 10 }],
  },
  {
    id: 'prod-007',
    name: 'Refined Vegetable Cooking Oil (25L Keg)',
    description: 'Pure, triple-filtered cholesterol-free vegetable oil for catering, frying, and culinary use.',
    sku: 'VEG-25L-007',
    priceCents: 5200000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-keg',
    categoryId: 'cat-oils',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-keg', name: '25L Keg', symbol: 'keg' },
    category: { id: 'cat-oils', name: 'Oils & Fats', description: null },
    inventory: [{ id: 'inv-7', productId: 'prod-007', quantity: 8, lowStockThreshold: 12 }],
  },
  {
    id: 'prod-008',
    name: 'Smoked Catfish & Dried Crayfish Bundle',
    description: 'Kiln-dried Oron crayfish combined with 5 large oven-smoked Nigerian catfish.',
    sku: 'CRAY-BDL-008',
    priceCents: 1200000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-pack',
    categoryId: 'cat-soup',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-pack', name: 'Bundle Pack', symbol: 'pack' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null },
    inventory: [{ id: 'inv-8', productId: 'prod-008', quantity: 35, lowStockThreshold: 5 }],
  },
  {
    id: 'prod-009',
    name: 'Fresh Scotch Bonnet Pepper & Rodo (Wholesale Basket)',
    description: 'Pungent, hot red scotch bonnet peppers direct from farm harvest.',
    sku: 'RODO-BSK-009',
    priceCents: 1450000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-basket',
    categoryId: 'cat-soup',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-basket', name: 'Farm Basket', symbol: 'basket' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null },
    inventory: [{ id: 'inv-9', productId: 'prod-009', quantity: 50, lowStockThreshold: 10 }],
  },
  {
    id: 'prod-010',
    name: 'Dry Kano Red Onions (Wholesale 50kg Sack)',
    description: 'Hard, thin-skinned pungent red onions with long storage life.',
    sku: 'ONION-50KG-010',
    priceCents: 4200000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-bag',
    categoryId: 'cat-soup',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-bag', name: '50kg Bag', symbol: 'bag' },
    category: { id: 'cat-soup', name: 'Soup Ingredients', description: null },
    inventory: [{ id: 'inv-10', productId: 'prod-010', quantity: 40, lowStockThreshold: 8 }],
  },
  {
    id: 'prod-011',
    name: 'Fresh Cooking Plantain (Stem Bunch / 80 Fingers)',
    description: 'Firm green and semi-ripe plantain bunch from Ondo plantation groves.',
    sku: 'PLANT-BNCH-011',
    priceCents: 1100000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1603052875302-d376b7c0638a?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-bunch',
    categoryId: 'cat-tubers',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-bunch', name: 'Stem Bunch', symbol: 'bunch' },
    category: { id: 'cat-tubers', name: 'Tubers & Roots', description: null },
    inventory: [{ id: 'inv-11', productId: 'prod-011', quantity: 45, lowStockThreshold: 8 }],
  },
  {
    id: 'prod-012',
    name: 'Yellow Bendel Cassava Garri (50kg Bag)',
    description: 'Rich, palm oil infused fried yellow garri from Delta State. Smooth texture with high density.',
    sku: 'YGARRI-50KG-012',
    priceCents: 4600000,
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
    unitId: 'unit-bag',
    categoryId: 'cat-grains',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: { id: 'unit-bag', name: '50kg Bag', symbol: 'bag' },
    category: { id: 'cat-grains', name: 'Grains & Flours', description: null },
    inventory: [{ id: 'inv-12', productId: 'prod-012', quantity: 50, lowStockThreshold: 10 }],
  },
];

const isUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dataDir = path.resolve(process.cwd(), '.data');
const primaryFilePath = path.join(dataDir, 'system_products.json');
const tempFilePath = path.join(os.tmpdir(), 'affy_system_products.json');

class SystemProductStore {
  private products: Map<string, SystemProduct> = new Map();
  private initialized = false;
  private lastSupabaseSync = 0;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;

    // 1. Baseline catalogue
    for (const item of INITIAL_CATALOG) {
      this.products.set(item.id, { ...item });
    }

    // 2. Load from disk if available
    this.loadFromDisk();

    this.initialized = true;

    // 3. Sync from Supabase in background
    this.fetchFromSupabase().catch(() => {});
  }

  private loadFromDisk() {
    for (const filePath of [primaryFilePath, tempFilePath]) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const item of parsed) {
              if (item && item.id) {
                this.products.set(item.id, item);
              }
            }
            return;
          }
        }
      } catch {}
    }
  }

  private saveToDisk() {
    const list = Array.from(this.products.values());
    const data = JSON.stringify(list, null, 2);

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(primaryFilePath, data, 'utf-8');
    } catch {}

    try {
      fs.writeFileSync(tempFilePath, data, 'utf-8');
    } catch {}
  }

  /**
   * Primary source of truth: Sync products, categories, units, and inventory directly from Supabase
   */
  public async fetchFromSupabase(): Promise<boolean> {
    if (!supabaseAdmin) {
      // Fallback to Prisma if configured
      return this.syncFromPrismaFallback();
    }

    try {
      const [prodsRes, catsRes, unitsRes, invsRes] = await Promise.all([
        supabaseAdmin.from('Product').select('*').order('name'),
        supabaseAdmin.from('Category').select('*'),
        supabaseAdmin.from('Unit').select('*'),
        supabaseAdmin.from('Inventory').select('*'),
      ]);

      if (prodsRes.error || !prodsRes.data || prodsRes.data.length === 0) {
        return this.syncFromPrismaFallback();
      }

      const cats = new Map((catsRes.data || []).map((c: any) => [c.id, c]));
      const units = new Map((unitsRes.data || []).map((u: any) => [u.id, u]));
      const invs = new Map((invsRes.data || []).map((i: any) => [i.productId, i]));

      const freshMap = new Map<string, SystemProduct>();

      for (const p of prodsRes.data) {
        const inv = invs.get(p.id);
        const cat = p.categoryId ? cats.get(p.categoryId) : null;
        const unit = p.unitId ? units.get(p.unitId) : null;
        const mapped: SystemProduct = {
          id: p.id,
          name: p.name,
          description: p.description,
          sku: p.sku || `SKU-${p.id.slice(0, 6)}`,
          priceCents: Number(p.priceCents ?? 0),
          currency: p.currency || 'NGN',
          imageUrl: p.imageUrl,
          unitId: p.unitId,
          categoryId: p.categoryId,
          isActive: p.isActive !== false,
          createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date(p.createdAt).toISOString(),
          updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date(p.updatedAt).toISOString(),
          unit: unit ? { id: unit.id, name: unit.name, symbol: unit.symbol } : null,
          category: cat ? { id: cat.id, name: cat.name, description: cat.description } : null,
          inventory: inv
            ? [{
                id: inv.id || `inv-${p.id}`,
                productId: p.id,
                quantity: Number(inv.quantity ?? 0),
                lowStockThreshold: Number(inv.lowStockThreshold ?? 10),
              }]
            : [{ id: `inv-${p.id}`, productId: p.id, quantity: 50, lowStockThreshold: 10 }],
        };

        freshMap.set(p.id, mapped);
      }

      this.products = freshMap;
      this.lastSupabaseSync = Date.now();
      this.saveToDisk();
      return true;
    } catch (err: any) {
      console.warn('[SystemProductStore] Supabase sync warning:', err.message);
      return this.syncFromPrismaFallback();
    }
  }

  private async syncFromPrismaFallback(): Promise<boolean> {
    try {
      const dbProducts = await prisma.product.findMany({
        include: { unit: true, category: true, inventory: true },
        take: 100,
      });

      if (dbProducts && dbProducts.length > 0) {
        for (const p of dbProducts) {
          const invQty = p.inventory?.quantity ? Number(p.inventory.quantity) : 50;
          const mapped: SystemProduct = {
            id: p.id,
            name: p.name,
            description: p.description,
            sku: p.sku || `SKU-${p.id.slice(0, 6)}`,
            priceCents: Number(p.priceCents),
            currency: p.currency || 'NGN',
            imageUrl: p.imageUrl,
            unitId: p.unitId,
            categoryId: p.categoryId,
            isActive: p.isActive,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            unit: p.unit ? { id: p.unit.id, name: p.unit.name, symbol: p.unit.symbol } : null,
            category: p.category ? { id: p.category.id, name: p.category.name, description: p.category.description } : null,
            inventory: [{ id: `inv-${p.id}`, productId: p.id, quantity: invQty, lowStockThreshold: 10 }],
          };
          this.products.set(p.id, mapped);
        }
        this.saveToDisk();
        return true;
      }
    } catch {}
    return false;
  }

  private loadSortMap(): Record<string, number> {
    const candidates = [
      path.resolve(process.cwd(), '.data', 'product_sort_order.json'),
      path.resolve(process.cwd(), 'backend', '.data', 'product_sort_order.json'),
      path.resolve(__dirname, '..', '..', '.data', 'product_sort_order.json'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          return JSON.parse(fs.readFileSync(p, 'utf-8'));
        }
      } catch {}
    }
    return {};
  }

  public getProductRank(p: { id: string; name: string }, sortMap?: Record<string, number>): number {
    const map = sortMap || this.loadSortMap();
    if (map[p.id] !== undefined) {
      return map[p.id];
    }
    const CANONICAL_FOOD_NAMES = [
      'Rice',
      'Beans',
      'Garri',
      'Spaghetti',
      'Noodles',
      'Semo',
      'Benue Giant White Yam (Set of 5 Huge Tubers)',
      'Butter',
      'Egg',
      'Fresh Cooking Plantain',
      'Maggi',
      'Milo Ordinary',
      'Refined Vegetable Cooking Oil',
      'Sachet Tomato',
      'Salt',
      'Sardines',
      'Thyme',
      'Curry',
    ];
    const cleanName = (p.name || '').trim().toLowerCase();
    for (let i = 0; i < CANONICAL_FOOD_NAMES.length; i++) {
      const target = CANONICAL_FOOD_NAMES[i].trim().toLowerCase();
      if (cleanName === target || cleanName.startsWith(target + ' ') || cleanName.startsWith(target)) {
        return i;
      }
    }
    return 100 + (p.name ? p.name.charCodeAt(0) : 0);
  }

  private async resolveCategory(categoryId?: string | null, categoryName?: string | null): Promise<string | null> {
    if (categoryId && isUuidRegex.test(categoryId)) return categoryId;
    if (!categoryName) return null;

    if (supabaseAdmin) {
      const { data: existing } = await supabaseAdmin.from('Category').select('id').ilike('name', categoryName.trim()).maybeSingle();
      if (existing) return existing.id;

      const newId = uuidv4();
      const { data: created } = await supabaseAdmin.from('Category').insert({
        id: newId,
        name: categoryName.trim(),
        description: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).select('id').single();

      if (created) return created.id;
    }
    return null;
  }

  private async resolveUnit(unitId?: string | null, unitName?: string | null): Promise<string | null> {
    if (!supabaseAdmin) return null;

    // 1. If valid UUID already, check if it matches an existing Unit
    if (unitId && isUuidRegex.test(unitId)) {
      const { data: byId } = await supabaseAdmin.from('Unit').select('id').eq('id', unitId).maybeSingle();
      if (byId) return byId.id;
    }

    // 2. Identify search string candidates from unitName or unitId (e.g. 'unit-derica' -> 'derica')
    const candidates: string[] = [];
    if (unitName && typeof unitName === 'string' && unitName.trim()) {
      candidates.push(unitName.trim());
    }
    if (unitId && typeof unitId === 'string' && !isUuidRegex.test(unitId)) {
      const stripped = unitId.replace(/^unit[-_]/i, '').trim();
      if (stripped && !candidates.includes(stripped)) candidates.push(stripped);
      if (!candidates.includes(unitId.trim())) candidates.push(unitId.trim());
    }

    for (const cand of candidates) {
      // Check by exact or case-insensitive name
      const { data: byName } = await supabaseAdmin.from('Unit').select('id').ilike('name', cand).maybeSingle();
      if (byName) return byName.id;

      // Check by symbol
      const { data: bySymbol } = await supabaseAdmin.from('Unit').select('id').ilike('symbol', cand).maybeSingle();
      if (bySymbol) return bySymbol.id;
    }

    // 3. If a name was supplied but doesn't exist, create it in Supabase
    const primaryName = unitName?.trim() || candidates[0];
    if (primaryName) {
      const newId = uuidv4();
      const symbol = primaryName.toLowerCase().replace(/\s+/g, '_');
      const { data: created, error } = await supabaseAdmin.from('Unit').insert({
        id: newId,
        name: primaryName,
        symbol: symbol,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).select('id').single();

      if (created) return created.id;
      if (error) console.error('[SystemProductStore] Unit creation error:', error.message);
    }

    return null;
  }

  /**
   * List products with search, pagination, and category filtering.
   * Pulls fresh data from Supabase and applies persistent canonical ordering.
   */
  public async list(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    includeInactive?: boolean;
  } = {}) {
    const { page = 1, limit = 50, search = '', categoryId, includeInactive = false } = params;

    // Refresh from Supabase if cache is cold or older than 10 seconds
    if (Date.now() - this.lastSupabaseSync > 10000 || this.products.size === 0) {
      await this.fetchFromSupabase();
    }

    let all = Array.from(this.products.values());

    if (!includeInactive) {
      all = all.filter((p) => p.isActive);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      all = all.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.category && p.category.name.toLowerCase().includes(q))
      );
    }

    if (categoryId) {
      all = all.filter((p) => p.categoryId === categoryId);
    }

    // Sort by persistent canonical food bank order
    const sortMap = this.loadSortMap();
    all.sort((a, b) => this.getProductRank(a, sortMap) - this.getProductRank(b, sortMap));

    const total = all.length;
    const startIndex = (page - 1) * limit;
    const items = all.slice(startIndex, startIndex + limit);

    return { total, page, limit, items };
  }

  /**
   * Get single product by ID or name
   */
  public async getById(id: string): Promise<SystemProduct | null> {
    if (this.products.has(id)) return this.products.get(id)!;
    const byName = Array.from(this.products.values()).find(
      (p) => p.name.toLowerCase() === id.toLowerCase()
    );
    if (byName) return byName;

    await this.fetchFromSupabase();
    return this.products.get(id) || Array.from(this.products.values()).find(
      (p) => p.name.toLowerCase() === id.toLowerCase()
    ) || null;
  }

  /**
   * Update an existing product directly in Supabase and return the persisted record
   */
  public async update(id: string, updates: Partial<{
    name: string;
    description: string | null;
    priceCents: number;
    stock: number;
    imageUrl: string | null;
    unitId: string | null;
    unitName: string | null;
    unit: string | null;
    categoryId: string | null;
    categoryName: string | null;
    isActive: boolean;
  }>): Promise<SystemProduct> {
    // 1. Locate existing product in memory or Supabase
    let targetId = id;
    let existing = this.products.get(id);

    if (!existing && !isUuidRegex.test(id)) {
      existing = Array.from(this.products.values()).find(
        (p) => p.id === id || (updates.name && p.name.toLowerCase() === updates.name.toLowerCase()) || p.name.toLowerCase() === id.toLowerCase()
      );
      if (existing) {
        targetId = existing.id;
      }
    }

    // Check directly in Supabase if not found by UUID
    if (supabaseAdmin && (!existing || !isUuidRegex.test(targetId))) {
      if (isUuidRegex.test(id)) {
        const { data: dbProd } = await supabaseAdmin.from('Product').select('*').eq('id', id).maybeSingle();
        if (dbProd) targetId = dbProd.id;
      } else {
        const searchName = updates.name || existing?.name || id;
        const { data: dbProd } = await supabaseAdmin.from('Product').select('*').ilike('name', searchName).maybeSingle();
        if (dbProd) targetId = dbProd.id;
      }
    }

    // If still not a UUID or not found in Supabase, create new product instead
    if (!isUuidRegex.test(targetId)) {
      return this.create({
        name: updates.name || 'Food Item',
        description: updates.description || undefined,
        priceCents: updates.priceCents ?? 100000,
        stock: updates.stock,
        imageUrl: updates.imageUrl || undefined,
        unitId: updates.unitId || undefined,
        unitName: updates.unitName || (updates as any).unit || undefined,
        categoryId: updates.categoryId || undefined,
        categoryName: updates.categoryName || undefined,
      });
    }

    const resolvedCategoryId = await this.resolveCategory(updates.categoryId, updates.categoryName);
    const resolvedUnitId = await this.resolveUnit(updates.unitId, updates.unitName || (updates as any).unit);

    // 2. Persist to Supabase "Product"
    if (supabaseAdmin) {
      const productPayload: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };
      if (updates.name !== undefined) productPayload.name = updates.name;
      if (updates.description !== undefined) productPayload.description = updates.description;
      if (updates.priceCents !== undefined) productPayload.priceCents = Number(updates.priceCents);
      if (updates.imageUrl !== undefined) productPayload.imageUrl = updates.imageUrl;
      if (updates.isActive !== undefined) productPayload.isActive = Boolean(updates.isActive);
      if (resolvedCategoryId) productPayload.categoryId = resolvedCategoryId;
      if (resolvedUnitId) productPayload.unitId = resolvedUnitId;

      const { error: prodErr } = await supabaseAdmin.from('Product').update(productPayload).eq('id', targetId);
      if (prodErr) {
        console.error('[SystemProductStore] Supabase product update error:', prodErr.message);
        throw new Error(`Failed to update product in Supabase: ${prodErr.message}`);
      }

      // 3. Persist to Supabase "Inventory"
      if (updates.stock !== undefined) {
        const stockQty = Number(updates.stock);
        const { data: existingInv } = await supabaseAdmin.from('Inventory').select('id').eq('productId', targetId).maybeSingle();
        if (existingInv) {
          await supabaseAdmin.from('Inventory').update({
            quantity: stockQty,
            updatedAt: new Date().toISOString(),
          }).eq('id', existingInv.id);
        } else {
          await supabaseAdmin.from('Inventory').insert({
            id: uuidv4(),
            productId: targetId,
            quantity: stockQty,
            lowStockThreshold: 10,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    // 4. Update Prisma in background (best effort)
    this.persistToPrismaAsync(targetId, updates);

    // 5. Refresh local in-memory representation
    await this.fetchFromSupabase();

    const result = this.products.get(targetId);
    if (result) return result;

    // Fallback constructed return
    const fallback: SystemProduct = {
      ...(existing || INITIAL_CATALOG[0]),
      id: targetId,
      name: updates.name ?? existing?.name ?? 'Food Item',
      description: updates.description ?? existing?.description ?? null,
      priceCents: updates.priceCents !== undefined ? Number(updates.priceCents) : existing?.priceCents ?? 0,
      imageUrl: updates.imageUrl ?? existing?.imageUrl ?? null,
      isActive: updates.isActive !== undefined ? Boolean(updates.isActive) : existing?.isActive ?? true,
      updatedAt: new Date().toISOString(),
      inventory: updates.stock !== undefined
        ? [{ id: `inv-${targetId}`, productId: targetId, quantity: Number(updates.stock), lowStockThreshold: 10 }]
        : existing?.inventory ?? null,
    };
    this.products.set(targetId, fallback);
    this.saveToDisk();
    return fallback;
  }

  /**
   * Create new product directly in Supabase
   */
  public async create(data: {
    name: string;
    description?: string;
    priceCents: number;
    stock?: number;
    imageUrl?: string;
    unitId?: string;
    unitName?: string;
    categoryId?: string;
    categoryName?: string;
  }): Promise<SystemProduct> {
    const id = uuidv4();
    const resolvedCategoryId = await this.resolveCategory(data.categoryId, data.categoryName);
    const resolvedUnitId = await this.resolveUnit(data.unitId, data.unitName);
    const stockQty = data.stock !== undefined ? Number(data.stock) : 50;

    if (supabaseAdmin) {
      await supabaseAdmin.from('Product').insert({
        id,
        name: data.name,
        description: data.description || null,
        sku: `SKU-${Date.now().toString().slice(-6)}`,
        priceCents: Number(data.priceCents),
        currency: 'NGN',
        imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
        unitId: resolvedUnitId,
        categoryId: resolvedCategoryId,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await supabaseAdmin.from('Inventory').insert({
        id: uuidv4(),
        productId: id,
        quantity: stockQty,
        lowStockThreshold: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await this.fetchFromSupabase();
    const created = this.products.get(id);
    if (created) return created;

    const fallback: SystemProduct = {
      id,
      name: data.name,
      description: data.description || null,
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      priceCents: Number(data.priceCents),
      currency: 'NGN',
      imageUrl: data.imageUrl || null,
      unitId: resolvedUnitId,
      categoryId: resolvedCategoryId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inventory: [{ id: `inv-${id}`, productId: id, quantity: stockQty, lowStockThreshold: 10 }],
    };
    this.products.set(id, fallback);
    this.saveToDisk();
    return fallback;
  }

  /**
   * Delete or deactivate product
   */
  public async delete(id: string): Promise<boolean> {
    let targetId = id;
    const existing = this.products.get(id);
    if (!existing && !isUuidRegex.test(id)) {
      const found = Array.from(this.products.values()).find(p => p.name.toLowerCase() === id.toLowerCase());
      if (found) targetId = found.id;
    }

    if (supabaseAdmin && isUuidRegex.test(targetId)) {
      await supabaseAdmin.from('Product').update({ isActive: false, updatedAt: new Date().toISOString() }).eq('id', targetId);
    }

    prisma.product.updateMany({
      where: { id: targetId },
      data: { isActive: false },
    }).catch(() => {});

    if (this.products.has(targetId)) {
      const p = this.products.get(targetId)!;
      p.isActive = false;
      this.products.set(targetId, p);
      this.saveToDisk();
    }
    return true;
  }

  /**
   * Quick restock
   */
  public async restock(id: string, amount: number): Promise<SystemProduct | null> {
    const p = await this.getById(id);
    if (!p) return null;

    const current = p.inventory?.[0]?.quantity ?? 0;
    const newQty = current + amount;

    return this.update(p.id, { stock: newQty });
  }

  private async persistToPrismaAsync(productId: string, updates: any) {
    if (!isUuidRegex.test(productId)) return;
    try {
      await prisma.product.update({
        where: { id: productId },
        data: {
          name: updates.name,
          description: updates.description,
          priceCents: updates.priceCents !== undefined ? BigInt(updates.priceCents) : undefined,
          imageUrl: updates.imageUrl,
          isActive: updates.isActive,
        },
      });
      if (updates.stock !== undefined) {
        await prisma.inventory.upsert({
          where: { productId },
          update: { quantity: Number(updates.stock) },
          create: { productId, quantity: Number(updates.stock), lowStockThreshold: 10 },
        });
      }
    } catch {}
  }
}

export const systemProductStore = new SystemProductStore();
