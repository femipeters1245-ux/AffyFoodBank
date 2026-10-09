// backend/src/routes/auth.ts
import { Router } from 'express';
import { register, login, logout, requestPasswordReset, resetPassword, seedDemo } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// Public endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/seed-demo', seedDemo);
router.post('/password-reset-request', requestPasswordReset);
router.post('/password-reset', resetPassword);

// Protected – logout (requires valid token)
router.post('/logout', authenticate, logout);

export default router;
