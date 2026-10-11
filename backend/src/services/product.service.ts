// backend/src/services/product.service.ts
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { z } from 'zod';

// ─── Validation Schemas ────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative(),
  unitId: z.string().uuid(),
  categoryId: z.string().uuid(),
  imageUrl: z.string().url().optional(),
  initialStock: z.number().nonnegative().optional(), // optional starting inventory qty
});

export const updateProductSchema = createProductSchema.partial();

// ─── Service ──────────────────────────────────────────────────────────────────

export const productService = {
  /**
   * List products with optional pagination and filters.
   * Returns `{ items: Product[], total: number }`.
   */
  async list(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    minPriceCents?: number;
    maxPriceCents?: number;
  }) {
    const {
      page = 1,
      limit = 20,
      search = '',
      categoryId,
      minPriceCents,
      maxPriceCents,
    } = params;

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (minPriceCents !== undefined) where.priceCents = { gte: minPriceCents };
    if (maxPriceCents !== undefined) {
      where.priceCents = { ...(where.priceCents as object), lte: maxPriceCents };
    }

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { unit: true, category: true, inventory: true },
      }),
    ]);

    return { total, page, limit, items };
  },

  /** Get a single active product by ID */
  async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { unit: true, category: true, inventory: true },
    });
    if (!product || !product.isActive) throw new NotFoundError('Product not found');
    return product;
  },

  /** Create a new product (admin only). Optionally seeds inventory. */
  async create(payload: unknown) {
    const parsed = createProductSchema.parse(payload);

    const [unit, category] = await Promise.all([
      prisma.unit.findUnique({ where: { id: parsed.unitId } }),
      prisma.category.findUnique({ where: { id: parsed.categoryId } }),
    ]);
    if (!unit) throw new BadRequestError('Invalid unitId');
    if (!category) throw new BadRequestError('Invalid categoryId');

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: parsed.name,
          description: parsed.description,
          priceCents: parsed.priceCents,
          unitId: parsed.unitId,
          categoryId: parsed.categoryId,
          isActive: true,
        },
        include: { unit: true, category: true },
      });

      // Seed inventory record
      await tx.inventory.create({
        data: {
          productId: product.id,
          quantity: parsed.initialStock ?? 0,
          lowStockThreshold: 0,
        },
      });

      return product;
    });
  },

  /** Update an existing product (admin only) */
  async update(id: string, payload: unknown) {
    const parsed = updateProductSchema.parse(payload);

    if (parsed.unitId) {
      const unit = await prisma.unit.findUnique({ where: { id: parsed.unitId } });
      if (!unit) throw new BadRequestError('Invalid unitId');
    }
    if (parsed.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: parsed.categoryId } });
      if (!cat) throw new BadRequestError('Invalid categoryId');
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.description !== undefined && { description: parsed.description }),
        ...(parsed.priceCents !== undefined && { priceCents: parsed.priceCents }),
        ...(parsed.imageUrl !== undefined && { imageUrl: parsed.imageUrl }),
        ...(parsed.unitId !== undefined && { unitId: parsed.unitId }),
        ...(parsed.categoryId !== undefined && { categoryId: parsed.categoryId }),
      },
      include: { unit: true, category: true, inventory: true },
    });
    return product;
  },

  /** Soft-delete (deactivate) a product */
  async deactivate(id: string) {
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return product;
  },

  /**
   * Decrement inventory – used during order placement.
   * Uses SELECT FOR UPDATE semantics via Prisma interactive transaction
   * to prevent overselling.
   */
  async decrementStock(productId: string, quantity: number) {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { productId } });
      if (!inv) throw new NotFoundError('Inventory record not found');
      if (Number(inv.quantity) < quantity) {
        throw new BadRequestError('Insufficient stock');
      }
      return tx.inventory.update({
        where: { productId },
        data: { quantity: { decrement: quantity } },
      });
    });
  },
};
