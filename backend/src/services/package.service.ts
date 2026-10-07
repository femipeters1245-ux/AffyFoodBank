// backend/src/services/package.service.ts
import prisma from '../prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for reusable product packages (pre-defined bundles).
 * Includes CRUD plus a method to expand a package into its constituent items.
 */
export const packageService = {
  async create(data: {
    name: string;
    description?: string;
    imageUrl?: string;
    items: { productId: string; quantity: number; unitId: string }[];
  }) {
    return prisma.$transaction(async (tx) => {
      const pkg = await tx.package.create({
        data: {
          id: uuidv4(),
          name: data.name,
          description: data.description,
          imageUrl: data.imageUrl,
        },
      });

      for (const it of data.items) {
        const prod = await tx.product.findUnique({ where: { id: it.productId } });
        const unit = await tx.unit.findUnique({ where: { id: it.unitId } });
        if (!prod) throw new BadRequestError(`Product ${it.productId} not found`);
        if (!unit) throw new BadRequestError(`Unit ${it.unitId} not found`);

        await tx.packageItem.create({
          data: {
            id: uuidv4(),
            packageId: pkg.id,
            productId: it.productId,
            quantity: it.quantity,
            unitId: it.unitId,
          },
        });
      }
      return pkg;
    });
  },

  async list() {
    return prisma.package.findMany({
      where: { status: 'ACTIVE' },
      include: { items: { include: { product: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: string) {
    const pkg = await prisma.package.findUnique({
      where: { id },
      include: { items: { include: { product: true, unit: true } } },
    });
    if (!pkg) throw new NotFoundError('Package not found');
    return pkg;
  },

  async update(
    id: string,
    data: Partial<{ name: string; description: string; imageUrl: string }>,
  ) {
    const pkg = await prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundError('Package not found');
    return prisma.package.update({ where: { id }, data });
  },

  async deactivate(id: string) {
    const pkg = await prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundError('Package not found');
    return prisma.package.update({ where: { id }, data: { status: 'INACTIVE' } });
  },
};
