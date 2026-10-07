import { Router } from 'express';
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Public: list and view (read)
router.get('/', authenticate, authorize('product:read'), getProducts);
router.get('/:id', authenticate, authorize('product:read'), getProductById);

// Protected: create, update, delete (admin/finance staff)
router.post(
  '/',
  authenticate,
  authorize('product:create'),
  createProduct,
);
router.patch(
  '/:id',
  authenticate,
  authorize('product:update'),
  updateProduct,
);
router.delete(
  '/:id',
  authenticate,
  authorize('product:delete'),
  deleteProduct,
);

export default router;
