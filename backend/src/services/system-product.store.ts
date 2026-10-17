// backend/src/services/system-product.store.ts
import fs from 'fs';
import path from 'path';
import os from 'os';
import prisma from '../prisma/client';

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

// Persistent file paths for system-managed inventory
const dataDir = path.resolve(process.cwd(), '.data');
const primaryFilePath = path.join(dataDir, 'system_products.json');
const tempFilePath = path.join(os.tmpdir(), 'affy_system_products.json');

class SystemProductStore {
  private products: Map<string, SystemProduct> = new Map();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;

    // 1. Populate initial catalogue
    for (const item of INITIAL_CATALOG) {
      this.products.set(item.id, { ...item });
    }

    // 2. Load from disk if available
    this.loadFromDisk();

    this.initialized = true;

    // 3. Sync from DB if available (non-blocking)
    this.syncFromDbBackground();
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
      } catch {
        // Continue to next path
      }
    }
  }

  private saveToDisk() {
    const list = Array.from(this.products.values());
    const data = JSON.stringify(list, null, 2);

    // Save to primary data directory
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(primaryFilePath, data, 'utf-8');
    } catch {
      // Ignored if readonly
    }

    // Save to /tmp for serverless persistence
    try {
      fs.writeFileSync(tempFilePath, data, 'utf-8');
    } catch {
      // Ignored
    }
  }

  private async syncFromDbBackground() {
    try {
      const dbProducts = await prisma.product.findMany({
        where: { isActive: true },
        include: { unit: true, category: true, inventory: true },
        take: 100,
      });

      if (dbProducts && dbProducts.length > 0) {
        for (const p of dbProducts) {
          const invQty = p.inventory?.[0]?.quantity ?? 50;
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

          // If we don't already have an edited version with this ID, or to align DB ids
          const existing = this.products.get(p.id) || Array.from(this.products.values()).find(x => x.name.toLowerCase() === p.name.toLowerCase());
          if (existing) {
            this.products.set(p.id, {
              ...mapped,
              priceCents: existing.priceCents || mapped.priceCents,
              name: existing.name || mapped.name,
              imageUrl: existing.imageUrl || mapped.imageUrl,
              inventory: existing.inventory || mapped.inventory,
            });
          } else {
            this.products.set(p.id, mapped);
          }
        }
      }
    } catch {
      // DB sync failure is completely fine — store operates self-sufficiently
    }
  }

  /**
   * List products with search, pagination, and category filtering.
   */
  public list(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    includeInactive?: boolean;
  } = {}) {
    const { page = 1, limit = 50, search = '', categoryId, includeInactive = false } = params;
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

    const total = all.length;
    const startIndex = (page - 1) * limit;
    const items = all.slice(startIndex, startIndex + limit);

    return { total, page, limit, items };
  }

  /**
   * Get single product by ID or name
   */
  public getById(id: string): SystemProduct | null {
    if (this.products.has(id)) return this.products.get(id)!;
    const found = Array.from(this.products.values()).find(
      (p) => p.id === id || p.name.toLowerCase() === id.toLowerCase()
    );
    return found || null;
  }

  /**
   * Push and persist product edit directly in the system.
   * Completely self-sufficient — does not rely on Supabase.
   */
  public update(id: string, updates: Partial<{
    name: string;
    description: string | null;
    priceCents: number;
    stock: number;
    imageUrl: string | null;
    unitId: string | null;
    unitName: string | null;
    categoryId: string | null;
    categoryName: string | null;
    isActive: boolean;
  }>): SystemProduct {
    let existing = this.getById(id);

    if (!existing) {
      // If updating by name or create on-the-fly
      if (updates.name) {
        existing = Array.from(this.products.values()).find(
          (p) => p.name.toLowerCase() === updates.name!.toLowerCase()
        ) || null;
      }
    }

    if (!existing) {
      // Create new system product
      const newId = id && id.length > 5 ? id : `prod-${Date.now()}`;
      existing = {
        id: newId,
        name: updates.name || 'Food Item',
        description: updates.description || null,
        sku: `SKU-${Date.now().toString().slice(-6)}`,
        priceCents: updates.priceCents ?? 100000,
        currency: 'NGN',
        imageUrl: updates.imageUrl || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
        unitId: updates.unitId || 'unit-bag',
        categoryId: updates.categoryId || 'cat-grains',
        isActive: updates.isActive !== undefined ? updates.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unit: { id: updates.unitId || 'unit-bag', name: updates.unitName || '50kg Bag', symbol: 'bag' },
        category: { id: updates.categoryId || 'cat-grains', name: updates.categoryName || 'Grains & Flours', description: null },
        inventory: [{ id: `inv-${newId}`, productId: newId, quantity: updates.stock ?? 50, lowStockThreshold: 10 }],
      };
      this.products.set(newId, existing);
    } else {
      // Apply updates to existing product
      if (updates.name !== undefined) existing.name = updates.name;
      if (updates.description !== undefined) existing.description = updates.description;
      if (updates.priceCents !== undefined) existing.priceCents = Number(updates.priceCents);
      if (updates.imageUrl !== undefined) existing.imageUrl = updates.imageUrl;
      if (updates.isActive !== undefined) existing.isActive = Boolean(updates.isActive);
      if (updates.unitId !== undefined) existing.unitId = updates.unitId;
      if (updates.categoryId !== undefined) existing.categoryId = updates.categoryId;

      if (updates.unitName && existing.unit) {
        existing.unit.name = updates.unitName;
      } else if (updates.unitName) {
        existing.unit = { id: existing.unitId || 'unit-custom', name: updates.unitName, symbol: 'unit' };
      }

      if (updates.categoryName && existing.category) {
        existing.category.name = updates.categoryName;
      } else if (updates.categoryName) {
        existing.category = { id: existing.categoryId || 'cat-custom', name: updates.categoryName, description: null };
      }

      if (updates.stock !== undefined) {
        const stockQty = Number(updates.stock);
        if (existing.inventory && existing.inventory.length > 0) {
          existing.inventory[0].quantity = stockQty;
        } else {
          existing.inventory = [{
            id: `inv-${existing.id}`,
            productId: existing.id,
            quantity: stockQty,
            lowStockThreshold: 10,
          }];
        }
      }

      existing.updatedAt = new Date().toISOString();
      this.products.set(existing.id, existing);
    }

    // Persist immediately to disk
    this.saveToDisk();

    // Background push to database (best-effort, non-blocking)
    this.persistToDbAsync(existing, updates.stock);

    return existing;
  }

  /**
   * Create new product
   */
  public create(data: {
    name: string;
    description?: string;
    priceCents: number;
    stock?: number;
    imageUrl?: string;
    unitId?: string;
    unitName?: string;
    categoryId?: string;
    categoryName?: string;
  }): SystemProduct {
    const id = `prod-${Date.now()}`;
    const product: SystemProduct = {
      id,
      name: data.name,
      description: data.description || null,
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      priceCents: Number(data.priceCents),
      currency: 'NGN',
      imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
      unitId: data.unitId || 'unit-bag',
      categoryId: data.categoryId || 'cat-grains',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      unit: { id: data.unitId || 'unit-bag', name: data.unitName || '50kg Bag', symbol: 'bag' },
      category: { id: data.categoryId || 'cat-grains', name: data.categoryName || 'Grains & Flours', description: null },
      inventory: [{ id: `inv-${id}`, productId: id, quantity: data.stock ?? 50, lowStockThreshold: 10 }],
    };

    this.products.set(id, product);
    this.saveToDisk();
    this.persistToDbAsync(product, data.stock);
    return product;
  }

  /**
   * Delete or deactivate product
   */
  public delete(id: string): boolean {
    const p = this.getById(id);
    if (!p) return false;

    p.isActive = false;
    p.updatedAt = new Date().toISOString();
    this.products.set(p.id, p);
    this.saveToDisk();

    // Best effort DB deactivation
    prisma.product.updateMany({
      where: { id: p.id },
      data: { isActive: false },
    }).catch(() => {});

    return true;
  }

  /**
   * Quick restock
   */
  public restock(id: string, amount: number): SystemProduct | null {
    const p = this.getById(id);
    if (!p) return null;

    const current = p.inventory?.[0]?.quantity ?? 0;
    const newQty = current + amount;

    return this.update(p.id, { stock: newQty });
  }

  private async persistToDbAsync(product: SystemProduct, stock?: number) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id);
      let dbRecord = isUuid ? await prisma.product.findUnique({ where: { id: product.id } }) : null;

      if (!dbRecord) {
        dbRecord = await prisma.product.findFirst({
          where: { name: { equals: product.name, mode: 'insensitive' } },
        });
      }

      if (dbRecord) {
        await prisma.product.update({
          where: { id: dbRecord.id },
          data: {
            name: product.name,
            description: product.description,
            priceCents: BigInt(product.priceCents),
            imageUrl: product.imageUrl,
            isActive: product.isActive,
          },
        });
        if (stock !== undefined) {
          await prisma.inventory.upsert({
            where: { productId: dbRecord.id },
            update: { quantity: Number(stock) },
            create: { productId: dbRecord.id, quantity: Number(stock), lowStockThreshold: 10 },
          });
        }
      }
    } catch {
      // Non-blocking
    }
  }
}

export const systemProductStore = new SystemProductStore();
