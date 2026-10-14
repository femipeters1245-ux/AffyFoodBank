import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import {
  createPackage,
  listPackages,
  getPackage,
  updatePackage,
  deactivatePackage,
} from '../controllers/package.controller';

const router = Router();

// Public: list and view packages
router.get('/', listPackages);
router.get('/:id', getPackage);

// Protected: management endpoints require auth & permissions
router.post('/', authenticate, authorize('package:create'), createPackage);
router.patch('/:id', authenticate, authorize('package:update'), updatePackage);
router.delete('/:id', authenticate, authorize('package:deactivate'), deactivatePackage);

export default router;
