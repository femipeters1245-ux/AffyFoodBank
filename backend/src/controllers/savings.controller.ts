// backend/src/controllers/savings.controller.ts
import { Request, Response, NextFunction } from 'express';
import { savingsService } from '../services/savings.service';
import { BadRequestError } from '../utils/errors';

export async function createSavingsPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');
    const plan = await savingsService.create(profileId, req.body);
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
}

export async function listSavingsPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');
    const plans = await savingsService.list(profileId);
    res.json(plans);
  } catch (err) {
    next(err);
  }
}

export async function getSavingsPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');
    const plan = await savingsService.getById(req.params.id, profileId);
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

export async function cancelSavingsPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const profileId = req.user?.profileId;
    if (!profileId) throw new BadRequestError('Customer profile ID missing from token');
    const plan = await savingsService.cancel(req.params.id, profileId);
    res.json(plan);
  } catch (err) {
    next(err);
  }
}
