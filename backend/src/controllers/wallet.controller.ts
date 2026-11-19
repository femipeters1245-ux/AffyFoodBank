// backend/src/controllers/wallet.controller.ts
import { Request, Response, NextFunction } from 'express';
import { walletService } from '../services/wallet.service';
import { transactPayService } from '../services/transactpay.service';
import { BadRequestError, ForbiddenError } from '../utils/errors';
import prisma from '../prisma/client';
import logger from '../utils/logger';

/** GET /wallet – returns wallet balances with active reservation calculation */
export async function getWallet(req: Request, res: Response, next: NextFunction) {
  const profileId = req.user?.profileId || `prof-${req.user?.sub}`;
  try {
    // Auto-requery pending withdrawals older than 2 minutes to reconcile state
    try {
      const pendingTxs = await walletService.listPendingWithdrawals(profileId);
      const now = Date.now();
      for (const tx of pendingTxs) {
        const txAgeMs = now - new Date(tx.createdAt).getTime();
        if (txAgeMs > 120000 && process.env.TRANSACTPAY_SECRET_KEY) {
          try {
            const requeryResult = await transactPayService.requeryPayout(tx.reference);
            if (requeryResult.status === 'SUCCESSFUL') {
              await walletService.finalizeSuccessfulWithdrawal({
                clientReference: tx.reference,
                providerReference: requeryResult.providerReference,
              });
            } else if (requeryResult.status === 'FAILED') {
              await walletService.releaseFailedWithdrawal({
                clientReference: tx.reference,
                reason: requeryResult.responseMessage || 'Provider reported payout failure',
                providerReference: requeryResult.providerReference,
              });
            }
          } catch (rErr: any) {
            logger.warn('[getWallet] Background requery note:', { reference: tx.reference, message: rErr.message });
          }
        }
      }
    } catch {}

    const wallet = await walletService.getWallet(profileId);
    res.json(wallet);
  } catch (err) {
    // Return resilient default wallet if DB is unreachable or record not yet created
    res.json({
      id: `wallet-${profileId}`,
      customerProfileId: profileId,
      totalBalanceCents: 0,
      allocatedToSavingsCents: 0,
      reservedWithdrawalCents: 0,
      availableBalanceCents: 0,
      currency: 'NGN',
      status: 'ACTIVE',
    });
  }
}

/** GET /wallet/transactions – list ledger entries for the authenticated customer */
export async function listTransactions(req: Request, res: Response, next: NextFunction) {
  const profileId = req.user?.profileId || `prof-${req.user?.sub}`;
  try {
    const transactions = await walletService.listTransactions(profileId);
    res.json(transactions);
  } catch (err) {
    res.json([]);
  }
}

/**
 * POST /wallet/deposit – Restricted to internal/administrative use only
 * Customer funds are strictly credited through verified TransactPay webhooks.
 */
export async function deposit(req: Request, res: Response, next: NextFunction) {
  try {
    const role = req.user?.role;
    if (role !== 'Admin' && role !== 'SuperAdmin') {
      throw new ForbiddenError(
        'Direct customer wallet crediting is disabled. Funds must be deposited through verified TransactPay virtual accounts or gateway payments.'
      );
    }

    const { amountCents, paymentReference, description } = req.body;
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');

    const wallet = await walletService.creditConfirmedDeposit({
      customerProfileId: profileId,
      amountCents: Number(amountCents),
      reference: paymentReference || `MANUAL-${Date.now()}`,
      sessionId: `MANUAL-${Date.now()}`,
      description: description || 'Administrative Deposit Adjustment',
    });

    res.status(201).json(wallet);
  } catch (err) {
    next(err);
  }
}

/** POST /wallet/withdraw – internal use */
export async function withdraw(req: Request, res: Response, next: NextFunction) {
  try {
    const { amountCents, description } = req.body;
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');

    const wallet = await walletService.getWallet(profileId);
    const amount = Number(amountCents);
    if (wallet.availableBalanceCents < amount) {
      throw new BadRequestError('Insufficient available wallet balance');
    }

    // Atomic debit
    await prisma.wallet.update({
      where: { customerProfileId: profileId },
      data: { totalBalanceCents: { decrement: BigInt(amount) } },
    });

    const updated = await walletService.getWallet(profileId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** POST /wallet/allocate – move funds to a savings plan */
export async function allocate(req: Request, res: Response, next: NextFunction) {
  try {
    const { savingsPlanId, amountCents } = req.body;
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');
    const wallet = await walletService.allocateToSavings({
      customerProfileId: profileId,
      savingsPlanId,
      amountCents,
    });
    res.json(wallet);
  } catch (err) {
    next(err);
  }
}

/** POST /wallet/release – release funds from a savings plan back to available balance */
export async function release(req: Request, res: Response, next: NextFunction) {
  try {
    const { savingsPlanId, amountCents } = req.body;
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');
    const wallet = await walletService.releaseFromSavings({
      customerProfileId: profileId,
      savingsPlanId,
      amountCents,
    });
    res.json(wallet);
  } catch (err) {
    next(err);
  }
}
