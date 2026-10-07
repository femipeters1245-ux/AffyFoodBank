import { Router } from 'express';
import {
  getWallet,
  deposit,
  withdraw,
  allocate,
  release,
  listTransactions,
} from '../controllers/wallet.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// Read‑only endpoints
router.get('/', authorize('wallet:read'), getWallet);
router.get('/transactions', authorize('wallet:read'), listTransactions);

// Mutating endpoints – fine‑grained permissions
router.post('/deposit', authorize('wallet:deposit'), deposit);
router.post('/withdraw', authorize('wallet:withdraw'), withdraw);
router.post('/allocate', authorize('wallet:allocate'), allocate);
router.post('/release', authorize('wallet:release'), release);

export default router;
