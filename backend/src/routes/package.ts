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

router.use(authenticate);
router.post('/', authorize('package:create'), createPackage);
router.get('/', authorize('package:read'), listPackages);
router.get('/:id', authorize('package:read'), getPackage);
router.patch('/:id', authorize('package:update'), updatePackage);
router.delete('/:id', authorize('package:deactivate'), deactivatePackage);

export default router;
