// backend/src/controllers/package.controller.ts
import { Request, Response, NextFunction } from 'express';
import { packageService } from '../services/package.service';

export async function createPackage(req: Request, res: Response, next: NextFunction) {
  try {
    const pkg = await packageService.create(req.body);
    res.status(201).json(pkg);
  } catch (err) {
    next(err);
  }
}

export async function listPackages(_req: Request, res: Response, next: NextFunction) {
  try {
    const pkgs = await packageService.list();
    res.json(pkgs);
  } catch (err) {
    next(err);
  }
}

export async function getPackage(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const pkg = await packageService.getById(id);
    res.json(pkg);
  } catch (err) {
    next(err);
  }
}

export async function updatePackage(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const pkg = await packageService.update(id, req.body);
    res.json(pkg);
  } catch (err) {
    next(err);
  }
}

export async function deactivatePackage(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await packageService.deactivate(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
