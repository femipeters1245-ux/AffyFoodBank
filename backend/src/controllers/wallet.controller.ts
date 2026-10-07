// backend/src/controllers/wallet.controller.ts
import { Request, Response, NextFunction } from 'express';
import { walletService } from '../services/wallet.service';
import { BadRequestError } from '../utils/errors';

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
    res.status(201).json(wallet);
  } catch (err) {
    next(err);
  }
}

/** POST /wallet/withdraw – internal use (e.g. order payment) */
export async function withdraw(req: Request, res: Response, next: NextFunction) {
  try {
    const { amountCents, description } = req.body;
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');
    const wallet = await walletService.withdraw({
      customerProfileId: profileId,
      amountCents,
      description,
    });
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
