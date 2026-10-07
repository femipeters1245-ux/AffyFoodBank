// backend/src/services/savings.service.ts
import prisma from '../prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

export const createSavingsPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetAmountCents: z.number().int().positive(),
  targetDate: z.string().datetime(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
        unitId: z.string().uuid(),
      }),
    )
    .optional(),
});

/**
 * Savings service – manage savings goals backed by the wallet ledger.
 * Fund allocation/release is handled by walletService to avoid circular deps.
 */
export const savingsService = {
  async create(customerProfileId: string, body: unknown) {
    const data = createSavingsPlanSchema.parse(body);

    // Verify customer has a wallet
    const wallet = await prisma.wallet.findUnique({ where: { customerProfileId } });
    if (!wallet) throw new NotFoundError('Wallet not found for this profile');

    return prisma.$transaction(async (tx) => {
      const plan = await tx.savingsPlan.create({
        data: {
          id: uuidv4(),
          customerProfileId,
          name: data.name,
          description: data.description,
          targetAmountCents: data.targetAmountCents,
          targetDate: new Date(data.targetDate),
          status: 'ACTIVE',
        },
      });

      // Optionally seed plan items
      for (const item of data.items ?? []) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        const unit = await tx.unit.findUnique({ where: { id: item.unitId } });
        if (!prod) throw new BadRequestError(`Product ${item.productId} not found`);
        if (!unit) throw new BadRequestError(`Unit ${item.unitId} not found`);

        await tx.savingsPlanItem.create({
          data: {
            id: uuidv4(),
            savingsPlanId: plan.id,
            productId: item.productId,
            quantity: item.quantity,
            unitId: item.unitId,
          },
        });
      }
      return plan;
    });
  },

  async list(customerProfileId: string) {
    return prisma.savingsPlan.findMany({
      where: { customerProfileId },
      include: { items: { include: { product: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: string, customerProfileId: string) {
    const plan = await prisma.savingsPlan.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, unit: true } },
        contributions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!plan || plan.customerProfileId !== customerProfileId) {
      throw new NotFoundError('Savings plan not found');
    }
    return plan;
  },

  async cancel(id: string, customerProfileId: string) {
    const plan = await prisma.savingsPlan.findUnique({ where: { id } });
    if (!plan || plan.customerProfileId !== customerProfileId) {
      throw new NotFoundError('Savings plan not found');
    }
    if (plan.status === 'COMPLETED' || plan.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot cancel a plan with status: ${plan.status}`);
    }
    return prisma.savingsPlan.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  },
};
