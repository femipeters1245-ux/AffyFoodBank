import { Router } from 'express';
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  restockProduct,
} from '../controllers/product.controller';

const router = Router();

// Public: list and view (read)
router.get('/', getProducts);
router.get('/:id', getProductById);

// System-managed product mutations: push edits directly
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.patch('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/:id/restock', restockProduct);

export default router;
