// backend/src/routes/savings.ts
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import {
  createSavingsPlan,
  listSavingsPlans,
  getSavingsPlan,
  cancelSavingsPlan,
} from '../controllers/savings.controller';

const router = Router();

// ─── FOOD SAVINGS SYSTEM RETIRED ────────────────────────────────────────────
// The Food Savings feature has been retired. All routes return HTTP 410 Gone.
// Data is preserved in the database; no records were deleted or modified.
// Rollback: set SAVINGS_RETIRED to false to restore normal routing.
const SAVINGS_RETIRED = true;

if (SAVINGS_RETIRED) {
  router.use((_req: Request, res: Response) => {
    return res.status(410).json({
      error: 'The Food Savings feature has been permanently retired.',
      code: 'FEATURE_RETIRED',
    });
  });
}

router.use(authenticate);

router.post('/', authorize('savings:create'), createSavingsPlan);
router.get('/', authorize('savings:read'), listSavingsPlans);
router.get('/:id', authorize('savings:read'), getSavingsPlan);
router.delete('/:id', authorize('savings:cancel'), cancelSavingsPlan);

export default router;
