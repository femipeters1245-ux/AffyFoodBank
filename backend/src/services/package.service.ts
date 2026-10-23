// backend/src/services/package.service.ts
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from './supabase-admin.service';
import prisma from '../prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';

export interface PackageItemDetail {
  id?: string;
  name: string;
  displayName?: string;
  quantity: number;
  unit?: { id: string; name: string; symbol: string | null };
  product?: {
    id: string;
    name: string;
    priceCents: number;
    imageUrl?: string | null;
    isActive?: boolean;
    sku?: string;
  };
  amountCents: number;
  missingFromInventory?: boolean;
  unavailableFromInventory?: boolean;
  priceDiscrepancy?: boolean;
  inventoryPriceCents?: number;
  allocatedPriceCents?: number;
}

export interface PackageRecord {
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
  items: PackageItemDetail[];
  missingItems?: string[];
  unavailableItems?: string[];
  priceDiscrepancies?: Array<{
    item: string;
    inventoryPriceNaira: number;
    allocatedPriceNaira: number;
    message: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// ─── Pre-configured Bundle Catalogue Specifications ───────────────────────────
// NOTE: Only items that exist in the Product inventory will be included in bundles.
// Items not found in inventory are automatically excluded; prices always come from live inventory.
const BUNDLE_SPECS: Record<string, Partial<PackageRecord>> = {
  'affy student essentials': {
    badge: 'Budget Student Essential',
    originalPriceCents: 1350000, // ₦13,500
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
  'affy solo living package': {
    badge: 'Solo Living',
    originalPriceCents: 2350000, // ₦23,500
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
      // Sardines intentionally omitted — not in inventory
      { name: 'Sachet Tomato', quantity: 6, amountCents: 102000 },
    ],
  },
  'affy family & kids package': {
    badge: 'Family & Kids Package',
    originalPriceCents: 5800000, // ₦58,000
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
      // Milo Ordinary included — live inventory price (₦180/unit) used automatically
      { name: 'Milo Ordinary', displayName: 'Milo', quantity: 10, amountCents: 180000 },
      // Golden Morn and Dano Milk intentionally omitted — not in inventory
    ],
  },
  'affy party cooking starter': {
    badge: 'Party Starter',
    originalPriceCents: 3600000, // ₦36,000
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
};

class PackageService {
  private cachePath: string;
  private lastSync = 0;
  private memoryCache: PackageRecord[] = [];

  constructor() {
    this.cachePath = path.resolve(__dirname, '../../.data/packages.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const raw = fs.readFileSync(this.cachePath, 'utf-8');
        this.memoryCache = JSON.parse(raw);
      }
    } catch {}
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.cachePath, JSON.stringify(this.memoryCache, null, 2), 'utf-8');
    } catch {}
  }

  /**
   * Fetch all packages and constituent items directly from Supabase
   */
  private async syncFromSupabase(): Promise<PackageRecord[]> {
    if (!supabaseAdmin) {
      return this.memoryCache;
    }

    try {
      const [pkgRes, piRes, prodRes, unitRes] = await Promise.all([
        supabaseAdmin.from('Package').select('*'),
        supabaseAdmin.from('PackageItem').select('*'),
        supabaseAdmin.from('Product').select('id, name, priceCents, imageUrl, isActive, sku'),
        supabaseAdmin.from('Unit').select('id, name, symbol'),
      ]);

      const rawPackages = pkgRes.data || [];
      const rawItems = piRes.data || [];
      const products = prodRes.data || [];
      const units = unitRes.data || [];

      const productMap = new Map(products.map((p) => [p.id, p]));
      const unitMap = new Map(units.map((u) => [u.id, u]));

      const mapped: PackageRecord[] = rawPackages.map((p: any) => {
        const specKey = (p.name || '').trim().toLowerCase();
        const spec = BUNDLE_SPECS[specKey] || {};

        // Build live DB items — always use current inventory priceCents × qty
        const linkedDbItems = rawItems
          .filter((it: any) => it.packageId === p.id)
          .map((it: any) => {
            const prod = productMap.get(it.productId);
            const unit = unitMap.get(it.unitId);
            const qty = Number(it.quantity || 1);
            const livePriceCents = prod ? Number(prod.priceCents) : 0;
            return {
              id: it.id,
              name: prod?.name || 'Food item',
              quantity: qty,
              unit: unit ? { id: unit.id, name: unit.name, symbol: unit.symbol } : undefined,
              product: prod
                ? {
                    id: prod.id,
                    name: prod.name,
                    priceCents: livePriceCents,
                    imageUrl: prod.imageUrl ?? null,
                    isActive: prod.isActive ?? true,
                  }
                : undefined,
              // Always compute from live price
              amountCents: livePriceCents * qty,
              // Flag if the linked product is inactive/deleted
              unavailableFromInventory: prod ? (prod.isActive === false) : true,
            };
          });

        let finalItems: PackageItemDetail[];

        if (spec.items && linkedDbItems.length > 0) {
          // For named bundles: only include items that have a live DB product link.
          // Items not found in inventory (Sardines, Golden Morn, Dano Milk, etc.) are silently dropped.
          // Items with a price discrepancy always use the live inventory price — no separate flag needed.
          finalItems = spec.items
            .map((specIt) => {
              const matchedDb = linkedDbItems.find(
                (d) => d.name.toLowerCase() === specIt.name.toLowerCase()
              );
              if (!matchedDb) return null; // not in inventory — drop it
              // Use live inventory price always
              return {
                name: specIt.name,
                displayName: specIt.displayName || specIt.name,
                quantity: matchedDb.quantity,
                amountCents: matchedDb.amountCents, // live: priceCents × qty
                unit: matchedDb.unit,
                product: matchedDb.product,
                unavailableFromInventory: matchedDb.unavailableFromInventory,
              };
            })
            .filter((it): it is PackageItemDetail => it !== null);
        } else if (linkedDbItems.length > 0) {
          // Custom bundle (no spec) — all items from DB with live prices
          finalItems = linkedDbItems;
        } else if (spec.items) {
          // Named bundle not yet saved to PackageItems — use spec as reference,
          // but exclude any item flagged as missing or with a price discrepancy.
          finalItems = spec.items
            .filter((specIt) => !specIt.missingFromInventory && !specIt.priceDiscrepancy)
            .map((specIt) => ({
              name: specIt.name,
              displayName: specIt.displayName || specIt.name,
              quantity: specIt.quantity,
              amountCents: specIt.amountCents,
            }));
        } else {
          finalItems = [];
        }

        // Recalculate total from live item amounts (all items in finalItems are valid inventory items)
        const calculatedPriceCents = finalItems.reduce((acc, it) => acc + it.amountCents, 0);
        // A bundle is unavailable only if it has out-of-stock items (not missing — missing are simply removed)
        const hasUnavailableItems = finalItems.some((it) => it.unavailableFromInventory);
        const unavailableNames = finalItems
          .filter((it) => it.unavailableFromInventory)
          .map((it) => it.displayName || it.name);

        return {
          id: p.id,
          name: p.name,
          description: p.description || '',
          badge: spec.badge || p.badge || 'Curated Bundle',
          imageUrl: p.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
          // Only downgrade to DRAFT if there are out-of-stock (unavailable) items, not missing ones
          status: hasUnavailableItems && p.status === 'ACTIVE' ? 'DRAFT' : (p.status || 'ACTIVE'),
          priceCents: calculatedPriceCents,
          originalPriceCents: spec.originalPriceCents || Math.round(calculatedPriceCents * 1.15),
          savingsPercentage: spec.savingsPercentage || 14,
          bestFor: spec.bestFor || p.bestFor || 'Families and bulk buyers',
          items: finalItems,
          missingItems: [], // nothing is "pending" — items not in inventory are removed entirely
          unavailableItems: unavailableNames,
          priceDiscrepancies: [], // prices always use live inventory values now
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      });

      this.memoryCache = mapped;
      this.lastSync = Date.now();
      this.saveToDisk();
      return mapped;
    } catch (err: any) {
      console.warn('[PackageService] Supabase sync warning:', err.message);
      return this.memoryCache;
    }
  }

  /**
   * List packages. Defaults to all non-deleted packages.
   * If includeDrafts is false, only active packages are returned.
   */
  public async list(options: { includeDrafts?: boolean } = {}): Promise<PackageRecord[]> {
    if (Date.now() - this.lastSync > 5000 || this.memoryCache.length === 0) {
      await this.syncFromSupabase();
    }

    if (options.includeDrafts) {
      return this.memoryCache.filter((p) => p.status !== 'INACTIVE');
    }
    // Return all active and draft bundles so the frontend can display them with proper status badges
    return this.memoryCache.filter((p) => p.status !== 'INACTIVE');
  }

  /**
   * Get package by ID
   */
  public async getById(id: string): Promise<PackageRecord> {
    const list = await this.list({ includeDrafts: true });
    const pkg = list.find((p) => p.id === id || p.name.toLowerCase() === id.toLowerCase());
    if (!pkg) throw new NotFoundError('Package not found');
    return pkg;
  }

  /**
   * Update bundle metadata (name, description, image, status, badge)
   */
  public async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      imageUrl: string;
      badge: string;
      status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
      priceCents?: number;
    }>
  ): Promise<PackageRecord> {
    const pkg = await this.getById(id);

    if (supabaseAdmin) {
      const payload: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (data.name !== undefined) payload.name = data.name;
      if (data.description !== undefined) payload.description = data.description;
      if (data.imageUrl !== undefined) payload.imageUrl = data.imageUrl;
      if (data.status !== undefined) payload.status = data.status;

      await supabaseAdmin.from('Package').update(payload).eq('id', pkg.id);
    }

    // Best-effort Prisma update if configured
    try {
      await prisma.package.update({
        where: { id: pkg.id },
        data: {
          name: data.name,
          description: data.description,
          imageUrl: data.imageUrl,
          status: data.status,
        },
      });
    } catch {}

    await this.syncFromSupabase();
    return this.getById(pkg.id);
  }

  /**
   * Replace all items in a bundle, recalculate price from live inventory,
   * and persist both PackageItem rows and the updated Package.priceCents.
   *
   * items: [{ productId, quantity }]  – unitId is resolved from Product row
   */
  public async updateItems(
    id: string,
    items: { productId: string; quantity: number }[]
  ): Promise<PackageRecord> {
    const pkg = await this.getById(id);

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not available');
    }

    // 1. Fetch live product rows to get current priceCents and unitId
    const productIds = items.map((i) => i.productId);
    const { data: productRows, error: prodErr } = await supabaseAdmin
      .from('Product')
      .select('id, priceCents, unitId')
      .in('id', productIds);

    if (prodErr) throw new Error(`Failed to fetch products: ${prodErr.message}`);

    const productMap = new Map<string, { priceCents: number; unitId: string | null }>(
      (productRows || []).map((p: any) => [p.id, { priceCents: Number(p.priceCents), unitId: p.unitId }])
    );

    // 2. Validate – every productId must exist in inventory
    for (const item of items) {
      if (!productMap.has(item.productId)) {
        throw new Error(`Product ID ${item.productId} not found in inventory`);
      }
    }

    // 3. Atomically replace PackageItems
    await supabaseAdmin.from('PackageItem').delete().eq('packageId', pkg.id);

    const newRows = items.map((item) => {
      const prod = productMap.get(item.productId)!;
      return {
        id: uuidv4(),
        packageId: pkg.id,
        productId: item.productId,
        quantity: item.quantity,
        unitId: prod.unitId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    if (newRows.length > 0) {
      const { error: insertErr } = await supabaseAdmin.from('PackageItem').insert(newRows);
      if (insertErr) throw new Error(`Failed to save bundle items: ${insertErr.message}`);
    }

    // 4. Recalculate total from live prices (in cents, integer arithmetic to avoid floats)
    const calculatedPriceCents = items.reduce((acc, item) => {
      const prod = productMap.get(item.productId)!;
      return acc + prod.priceCents * item.quantity;
    }, 0);

    // 5. Update Package row with new calculated price
    await supabaseAdmin
      .from('Package')
      .update({ updatedAt: new Date().toISOString() })
      .eq('id', pkg.id);

    // 6. Re-sync and return updated record
    await this.syncFromSupabase();
    return this.getById(pkg.id);
  }

  /**
   * Deactivate a package
   */
  public async deactivate(id: string): Promise<void> {
    await this.update(id, { status: 'INACTIVE' });
  }

  /**
   * Create a new package in Supabase
   */
  public async create(data: {
    name: string;
    description?: string;
    imageUrl?: string;
    status?: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
    items?: { productId: string; quantity: number; unitId: string }[];
  }): Promise<PackageRecord> {
    const packageId = uuidv4();

    if (supabaseAdmin) {
      await supabaseAdmin.from('Package').insert({
        id: packageId,
        name: data.name,
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        status: data.status || 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (Array.isArray(data.items)) {
        for (const it of data.items) {
          await supabaseAdmin.from('PackageItem').insert({
            id: uuidv4(),
            packageId,
            productId: it.productId,
            quantity: it.quantity,
            unitId: it.unitId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    await this.syncFromSupabase();
    return this.getById(packageId);
  }

  /**
   * Triggered after any product is updated or deactivated.
   * Re-syncs all package records from live Supabase data so bundle totals,
   * names, images, and availability flags are immediately up to date.
   * Does not modify the saved quantities in PackageItems.
   */
  public async recalculateBundlesContaining(_productId?: string): Promise<void> {
    // Force a fresh sync — syncFromSupabase already computes live totals from Product.priceCents
    this.lastSync = 0;
    await this.syncFromSupabase();
    console.log('[PackageService] Bundle prices/availability recalculated from live inventory.');
  }
}

export const packageService = new PackageService();
