// backend/src/routes/zones.ts
import { Router, Request, Response, NextFunction } from 'express';
import { coverageZoneService } from '../services/coverageZone.service';
import { authenticate } from '../middleware/authenticate';
import { BadRequestError } from '../utils/errors';

const router = Router();

/**
 * GET /api/v1/zones
 * Public/authenticated endpoint returning all actively approved coverage zones.
 * Used by registration, portal, and checkout dropdowns. No hardcoded lists.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const zones = await coverageZoneService.getActiveZones();
    res.json({ status: 'success', data: zones, count: zones.length });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/zones
 * Admin oversight: returns all coverage zones with live computed monitoring figures.
 * Restricted to Admin and SuperAdmin roles.
 */
router.get('/admin', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin' && role !== 'SuperAdmin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
    }

    const zones = await coverageZoneService.getAllZonesWithStats();
    res.json({ status: 'success', data: zones, count: zones.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/zones
 * Admin: Add a new coverage zone
 */
router.post('/admin', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin' && role !== 'SuperAdmin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
    }

    const { name, targetAdpCount } = req.body;
    if (!name) {
      throw new BadRequestError('Zone name is required');
    }

    const zone = await coverageZoneService.createZone({ name, targetAdpCount });
    res.status(201).json({ status: 'success', data: zone });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/admin/zones/:id/toggle
 * Admin: Toggle zone active state
 */
router.patch('/admin/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin' && role !== 'SuperAdmin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
    }

    const { id } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      throw new BadRequestError('isActive boolean is required');
    }

    const updated = await coverageZoneService.toggleZoneActive(id, isActive);
    res.json({ status: 'success', data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/admin/zones/:id/target
 * Admin: Update zone target ADP count
 */
router.patch('/admin/:id/target', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin' && role !== 'SuperAdmin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
    }

    const { id } = req.params;
    const { targetAdpCount } = req.body;
    if (!targetAdpCount || isNaN(Number(targetAdpCount))) {
      throw new BadRequestError('Valid targetAdpCount is required');
    }

    const updated = await coverageZoneService.updateZoneTarget(id, Number(targetAdpCount));
    res.json({ status: 'success', data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/zones/seed
 * Admin: Trigger idempotent seeding of official 13 zones
 */
router.post('/admin/seed', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin' && role !== 'SuperAdmin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
    }

    const zones = await coverageZoneService.seedCoverageZones();
    res.json({ status: 'success', message: `Seeded/verified ${zones.length} coverage zones`, data: zones });
  } catch (err) {
    next(err);
  }
});

export default router;
