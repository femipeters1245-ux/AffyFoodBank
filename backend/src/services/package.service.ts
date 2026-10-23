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
  product?: { id: string; name: string; priceCents: number; sku?: string };
  amountCents: number;
  missingFromInventory?: boolean;
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
const BUNDLE_SPECS: Record<string, Partial<PackageRecord>> = {
  'affy student essentials': {
    badge: 'Budget Student Essential',
    priceCents: 1153000, // ₦11,530
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
    priceCents: 2007000, // ₦20,070
    originalPriceCents: 2350000, // ₦23,500
    savingsPercentage: 15,
    bestFor: 'Bachelors and spinsters who want variety for everyday cooking',
    missingItems: ['Sardines'],
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
      { name: 'Sardines', quantity: 2, amountCents: 200000, missingFromInventory: true },
      { name: 'Sachet Tomato', quantity: 6, amountCents: 102000 },
    ],
  },
  'affy family & kids package': {
    badge: 'Family & Kids Package',
    priceCents: 5050000, // ₦50,500
    originalPriceCents: 5800000, // ₦58,000
    savingsPercentage: 13,
    bestFor: 'Household staples with breakfast options for the children',
    missingItems: ['Golden Morn', 'Dano Milk'],
    priceDiscrepancies: [
      {
        item: 'Milo',
        inventoryPriceNaira: 180,
        allocatedPriceNaira: 300,
        message: 'Milo Ordinary is ₦180 in inventory, but Family & Kids Package allocates ₦300 per unit (₦3,000 for 10).',
      },
    ],
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
      { name: 'Golden Morn', quantity: 10, amountCents: 250000, missingFromInventory: true },
      {
        name: 'Milo Ordinary',
        displayName: 'Milo',
        quantity: 10,
        amountCents: 300000,
        priceDiscrepancy: true,
        inventoryPriceCents: 18000,
        allocatedPriceCents: 30000,
      },
      { name: 'Dano Milk', quantity: 10, amountCents: 130000, missingFromInventory: true },
    ],
  },
  'affy party cooking starter': {
    badge: 'Party Starter',
    priceCents: 3140000, // ₦31,400
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
        supabaseAdmin.from('Product').select('id, name, priceCents, sku'),
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

        const linkedDbItems = rawItems
          .filter((it: any) => it.packageId === p.id)
          .map((it: any) => {
            const prod = productMap.get(it.productId);
            const unit = unitMap.get(it.unitId);
            return {
              id: it.id,
              name: prod?.name || 'Food item',
              quantity: Number(it.quantity || 1),
              unit: unit ? { id: unit.id, name: unit.name, symbol: unit.symbol } : undefined,
              product: prod ? { id: prod.id, name: prod.name, priceCents: Number(prod.priceCents) } : undefined,
              amountCents: prod ? Number(prod.priceCents) * Number(it.quantity) : 0,
            };
          });

        // Use spec items as the comprehensive item definition (which includes items pending inventory import)
        const finalItems: PackageItemDetail[] = spec.items
          ? spec.items.map((specIt) => {
              const matchedDb = linkedDbItems.find(
                (d) => d.name.toLowerCase() === specIt.name.toLowerCase()
              );
              return {
                name: specIt.name,
                displayName: specIt.displayName || specIt.name,
                quantity: specIt.quantity,
                amountCents: specIt.amountCents,
                unit: matchedDb?.unit,
                product: matchedDb?.product,
                missingFromInventory: specIt.missingFromInventory,
                priceDiscrepancy: specIt.priceDiscrepancy,
                inventoryPriceCents: specIt.inventoryPriceCents,
                allocatedPriceCents: specIt.allocatedPriceCents,
              };
            })
          : linkedDbItems;

        const calculatedPriceCents = spec.priceCents ?? finalItems.reduce((acc, it) => acc + it.amountCents, 0);

        return {
          id: p.id,
          name: p.name,
          description: p.description || '',
          badge: spec.badge || 'Curated Bundle',
          imageUrl: p.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
          status: p.status || 'ACTIVE',
          priceCents: calculatedPriceCents,
          originalPriceCents: spec.originalPriceCents || Math.round(calculatedPriceCents * 1.15),
          savingsPercentage: spec.savingsPercentage || 14,
          bestFor: spec.bestFor || 'Families and bulk buyers',
          items: finalItems,
          missingItems: spec.missingItems || [],
          priceDiscrepancies: spec.priceDiscrepancies || [],
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
   * Update bundle status, description, image, or name
   */
  public async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      imageUrl: string;
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
}

export const packageService = new PackageService();
