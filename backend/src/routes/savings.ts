// backend/src/routes/savings.ts
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import {
  createSavingsPlan,
  listSavingsPlans,
  getSavingsPlan,
  cancelSavingsPlan,
} from '../controllers/savings.controller';

const router = Router();

router.use(authenticate);

router.post('/', authorize('savings:create'), createSavingsPlan);
router.get('/', authorize('savings:read'), listSavingsPlans);
router.get('/:id', authorize('savings:read'), getSavingsPlan);
router.delete('/:id', authorize('savings:cancel'), cancelSavingsPlan);

export default router;
