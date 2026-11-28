import { Router, Request, Response } from 'express';
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

// ─── WALLET SYSTEM RETIRED ──────────────────────────────────────────────────
// The customer wallet feature has been retired. All routes return HTTP 410 Gone.
// Data is preserved in the database; no records were deleted or modified.
// Rollback: set WALLET_RETIRED to false to restore normal routing.
const WALLET_RETIRED = true;

if (WALLET_RETIRED) {
  router.use((_req: Request, res: Response) => {
    return res.status(410).json({
      error: 'The Wallet feature has been permanently retired.',
      code: 'FEATURE_RETIRED',
    });
  });
}

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
