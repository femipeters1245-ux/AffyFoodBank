// backend/src/controllers/wallet.controller.ts
import { Request, Response, NextFunction } from 'express';
import { walletService } from '../services/wallet.service';
import { BadRequestError } from '../utils/errors';
import prisma from '../prisma/client';
import { sendWalletDepositEmail, sendWalletWithdrawalEmail } from '../services/email.service';

/** GET /wallet – returns wallet balances for the authenticated customer */
export async function getWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');
    const wallet = await walletService.getWallet(profileId);
    res.json(wallet);
  } catch (err) {
    next(err);
  }
}

/** GET /wallet/transactions – list ledger entries for the authenticated customer */
export async function listTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');
    const transactions = await walletService.listTransactions(profileId);
    res.json(transactions);
  } catch (err) {
    next(err);
  }
}

/** POST /wallet/deposit – external payment gateway will call this (trusted) */
export async function deposit(req: Request, res: Response, next: NextFunction) {
  try {
    const { amountCents, paymentReference, description } = req.body;
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');
    const wallet = await walletService.deposit({
      customerProfileId: profileId,
      amountCents,
      paymentReference,
      description,
    });

    // Send deposit email confirmation
    try {
      const email = req.user?.email;
      if (email) {
        const profile = await prisma.customerProfile.findUnique({
          where: { id: profileId },
          include: { user: true },
        });
        const customerName = profile?.user?.firstName
          ? [profile.user.firstName, profile.user.lastName].filter(Boolean).join(' ')
          : 'Affy Customer';

        sendWalletDepositEmail({
          to: email,
          customerName,
          amountNaira: Number(amountCents) / 100,
          newBalanceNaira: Number(wallet.totalBalanceCents) / 100,
          channel: 'Direct Deposit',
          reference: paymentReference || `DEP-${Date.now()}`,
        }).catch((err) => console.warn('[Resend] Direct deposit email failed:', err.message));
      }
    } catch (e: any) {
      console.warn('[Resend] Could not construct deposit email:', e.message);
    }

    res.status(201).json(wallet);
  } catch (err) {
    next(err);
  }
}

/** POST /wallet/withdraw – internal use (e.g. order payment) */
export async function withdraw(req: Request, res: Response, next: NextFunction) {
  try {
    const { amountCents, description, accountNumber, bankName } = req.body;
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');
    const wallet = await walletService.withdraw({
      customerProfileId: profileId,
      amountCents,
      description,
    });

    // Send withdrawal email notification
    try {
      const email = req.user?.email;
      if (email) {
        const profile = await prisma.customerProfile.findUnique({
          where: { id: profileId },
          include: { user: true },
        });
        const customerName = profile?.user?.firstName
          ? [profile.user.firstName, profile.user.lastName].filter(Boolean).join(' ')
          : 'Affy Customer';

        sendWalletWithdrawalEmail({
          to: email,
          customerName,
          amountNaira: Number(amountCents) / 100,
          remainingBalanceNaira: Number(wallet.totalBalanceCents) / 100,
          bankName: bankName || 'Bank Account',
          accountNumber: accountNumber || '0000000000',
          reference: `WDR-${Date.now()}`,
          status: 'SUCCESSFUL',
        }).catch((err) => console.warn('[Resend] Internal withdrawal email failed:', err.message));
      }
    } catch (e: any) {
      console.warn('[Resend] Could not construct withdrawal email:', e.message);
    }

    res.json(wallet);
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
