// backend/src/services/wallet.service.ts
import prisma from '../prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * Wallet service – atomic operations on a customer's wallet and its transaction ledger.
 * All functions expect the caller to have already verified the customer's identity.
 */
export const walletService = {
  /** Retrieve the wallet for a given customer profile ID. */
  async getWallet(customerProfileId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { customerProfileId },
    });
    if (!wallet) throw new NotFoundError('Wallet not found');
    return wallet;
  },

  /** List recent wallet transactions (newest first, limit 50). */
  async listTransactions(customerProfileId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { customerProfileId } });
    if (!wallet) throw new NotFoundError('Wallet not found');
    return prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  /** Deposit money into the wallet – idempotent via unique paymentReference. */
  async deposit(params: {
    customerProfileId: string;
    amountCents: number;
    paymentReference: string;
    description?: string;
  }) {
    const { customerProfileId, amountCents, paymentReference, description } = params;
    if (amountCents <= 0) throw new BadRequestError('Deposit amount must be positive');

    // Ensure we haven't processed this reference before.
    const existing = await prisma.walletTransaction.findFirst({
      where: { reference: paymentReference },
    });
    if (existing) throw new ConflictError('Duplicate payment reference');

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { customerProfileId } });
      if (!wallet) throw new NotFoundError('Wallet not found');

      const updated = await tx.wallet.update({
        where: { customerProfileId },
        data: { totalBalanceCents: { increment: amountCents } },
      });

      await tx.walletTransaction.create({
        data: {
          id: uuidv4(),
          walletId: updated.id,
          customerId: customerProfileId,
          reference: paymentReference,
          type: 'DEPOSIT',
          amountCents,
          currency: wallet.currency,
          direction: 'IN',
          status: 'SUCCESSFUL',
          description: description ?? 'Wallet deposit',
        },
      });
      return updated;
    });
  },

  /** Withdraw money – ensures sufficient available balance. */
  async withdraw(params: {
    customerProfileId: string;
    amountCents: number;
    description?: string;
  }) {
    const { customerProfileId, amountCents, description } = params;
    if (amountCents <= 0) throw new BadRequestError('Withdrawal amount must be positive');

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { customerProfileId } });
      if (!wallet) throw new NotFoundError('Wallet not found');

      const available =
        Number(wallet.totalBalanceCents) - Number(wallet.allocatedToSavingsCents);
      if (available < amountCents) {
        throw new ConflictError('Insufficient available balance');
      }

      const updated = await tx.wallet.update({
        where: { customerProfileId },
        data: { totalBalanceCents: { decrement: amountCents } },
      });

      await tx.walletTransaction.create({
        data: {
          id: uuidv4(),
          walletId: updated.id,
          customerId: customerProfileId,
          reference: `withdraw-${Date.now()}-${uuidv4().slice(0, 8)}`,
          type: 'WITHDRAWAL',
          amountCents,
          currency: wallet.currency,
          direction: 'OUT',
          status: 'SUCCESSFUL',
          description: description ?? 'Wallet withdrawal',
        },
      });
      return updated;
    });
  },

  /** Move funds from available balance into a savings plan allocation. */
  async allocateToSavings(params: {
    customerProfileId: string;
    savingsPlanId: string;
    amountCents: number;
  }) {
    const { customerProfileId, savingsPlanId, amountCents } = params;
    if (amountCents <= 0) throw new BadRequestError('Allocation amount must be positive');

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { customerProfileId } });
      if (!wallet) throw new NotFoundError('Wallet not found');

      const available =
        Number(wallet.totalBalanceCents) - Number(wallet.allocatedToSavingsCents);
      if (available < amountCents) {
        throw new ConflictError('Insufficient available balance to allocate');
      }

      const plan = await tx.savingsPlan.findUnique({ where: { id: savingsPlanId } });
      if (!plan) throw new NotFoundError('Savings plan not found');

      const updatedWallet = await tx.wallet.update({
        where: { customerProfileId },
        data: { allocatedToSavingsCents: { increment: amountCents } },
      });

      const txRecord = await tx.walletTransaction.create({
        data: {
          id: uuidv4(),
          walletId: wallet.id,
          customerId: customerProfileId,
          reference: `savings-alloc-${Date.now()}-${uuidv4().slice(0, 8)}`,
          type: 'SAVINGS_ALLOCATION',
          amountCents,
          currency: wallet.currency,
          direction: 'OUT',
          status: 'SUCCESSFUL',
          description: `Allocation to savings plan: ${plan.name}`,
        },
      });

      await tx.savingsPlan.update({
        where: { id: savingsPlanId },
        data: { amountSavedCents: { increment: amountCents } },
      });

      await tx.savingsContribution.create({
        data: {
          id: uuidv4(),
          savingsPlanId,
          walletTransactionId: txRecord.id,
          amountCents,
        },
      });

      return updatedWallet;
    });
  },

  /** Release funds from a savings plan allocation back to available balance. */
  async releaseFromSavings(params: {
    customerProfileId: string;
    savingsPlanId: string;
    amountCents: number;
  }) {
    const { customerProfileId, savingsPlanId, amountCents } = params;
    if (amountCents <= 0) throw new BadRequestError('Release amount must be positive');

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { customerProfileId } });
      if (!wallet) throw new NotFoundError('Wallet not found');

      const plan = await tx.savingsPlan.findUnique({ where: { id: savingsPlanId } });
      if (!plan) throw new NotFoundError('Savings plan not found');

      if (Number(plan.amountSavedCents) < amountCents) {
        throw new ConflictError('Plan does not have enough allocated to release');
      }

      const updatedWallet = await tx.wallet.update({
        where: { customerProfileId },
        data: { allocatedToSavingsCents: { decrement: amountCents } },
      });

      await tx.walletTransaction.create({
        data: {
          id: uuidv4(),
          walletId: wallet.id,
          customerId: customerProfileId,
          reference: `savings-release-${Date.now()}-${uuidv4().slice(0, 8)}`,
          type: 'SAVINGS_RELEASE',
          amountCents,
          currency: wallet.currency,
          direction: 'IN',
          status: 'SUCCESSFUL',
          description: `Release from savings plan: ${plan.name}`,
        },
      });

      await tx.savingsPlan.update({
        where: { id: savingsPlanId },
        data: { amountSavedCents: { decrement: amountCents } },
      });

      return updatedWallet;
    });
  },
};
