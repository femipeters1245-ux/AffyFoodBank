// backend/src/controllers/product.controller.ts
import { Request, Response, NextFunction } from 'express';
import { systemProductStore } from '../services/system-product.store';
import { z } from 'zod';

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  includeInactive: z.coerce.boolean().optional(),
});

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, priceCents, stock, imageUrl, unitId, unitName, categoryId, categoryName } = req.body;
    if (!name || priceCents === undefined) {
      return res.status(400).json({ error: 'Name and priceCents are required' });
    }

    const created = systemProductStore.create({
      name,
      description,
      priceCents: Number(priceCents),
      stock: stock !== undefined ? Number(stock) : 50,
      imageUrl,
      unitId,
      unitName,
      categoryId,
      categoryName,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const params = listQuerySchema.parse(req.query);
    const result = systemProductStore.list(params);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const product = systemProductStore.getById(id);
    if (!product || !product.isActive) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      priceCents,
      stock,
      imageUrl,
      unitId,
      unitName,
      categoryId,
      categoryName,
      isActive,
    } = req.body;

    const updated = systemProductStore.update(id, {
      name,
      description,
      priceCents: priceCents !== undefined ? Number(priceCents) : undefined,
      stock: stock !== undefined ? Number(stock) : undefined,
      imageUrl,
      unitId,
      unitName,
      categoryId,
      categoryName,
      isActive,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const success = systemProductStore.delete(id);
    if (!success) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json({ message: 'Product deleted successfully', id });
  } catch (err) {
    next(err);
  }
}

export async function restockProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const amount = Number(req.body.amount || 20);
    const updated = systemProductStore.restock(id, amount);
    if (!updated) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
