// backend/src/services/payment.service.ts
import prisma from '../prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { ConflictError, BadRequestError, NotFoundError } from '../utils/errors';

/**
 * Mock payment gateway integration (e.g. Paystack / Flutterwave simulator).
 * Handles payment intent initialization, simulated webhook/capture, and refunds.
 */
export const paymentService = {
  /**
   * Simulate a payment initialization. Returns a payment reference and checkout URL.
   */
  async initializePayment(params: {
    customerProfileId: string;
    amountCents: number;
    currency?: string;
    description?: string;
  }) {
    const { customerProfileId, amountCents, currency = 'NGN', description } = params;
    if (amountCents <= 0) {
      throw new BadRequestError('Amount must be positive');
    }

    const wallet = await prisma.wallet.findUnique({
      where: { customerProfileId },
    });
    if (!wallet) throw new NotFoundError('Customer wallet not found');

    const reference = `pay_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    const transaction = await prisma.walletTransaction.create({
      data: {
        id: uuidv4(),
        walletId: wallet.id,
        customerId: customerProfileId,
        reference,
        type: 'DEPOSIT',
        amountCents: BigInt(amountCents),
        currency,
        direction: 'IN',
        status: 'PENDING',
        description: description ?? 'Card payment via gateway',
        paymentReference: reference,
      },
    });

    return {
      reference,
      transactionId: transaction.id,
      amountCents,
      currency,
      checkoutUrl: `https://checkout.affyfoodbank.mock/pay/${reference}`,
    };
  },

  /**
   * Simulate a payment capture / webhook completion.
   */
  async capture(reference: string): Promise<string> {
    const tx = await prisma.walletTransaction.findUnique({ where: { reference } });
    if (!tx) {
      throw new NotFoundError('Transaction reference not found');
    }
    if (tx.status === 'SUCCESSFUL') {
      return reference;
    }

    await prisma.$transaction(async (prismaTx) => {
      await prismaTx.wallet.update({
        where: { id: tx.walletId },
        data: { totalBalanceCents: { increment: tx.amountCents } },
      });

      await prismaTx.walletTransaction.update({
        where: { reference },
        data: { status: 'SUCCESSFUL' },
      });
    });

    return reference;
  },

  /**
   * Simulate a refund – marks the transaction as REVERSED.
   */
  async refund(reference: string): Promise<void> {
    const tx = await prisma.walletTransaction.findUnique({ where: { reference } });
    if (!tx) {
      throw new NotFoundError('Transaction not found');
    }
    if (tx.status === 'REVERSED') {
      throw new ConflictError('Transaction already reversed');
    }
    if (tx.status !== 'SUCCESSFUL') {
      throw new BadRequestError('Cannot refund an unsuccessful transaction');
    }

    await prisma.$transaction(async (prismaTx) => {
      await prismaTx.wallet.update({
        where: { id: tx.walletId },
        data: { totalBalanceCents: { decrement: tx.amountCents } },
      });

      await prismaTx.walletTransaction.update({
        where: { reference },
        data: { status: 'REVERSED' },
      });
    });
  },
};

