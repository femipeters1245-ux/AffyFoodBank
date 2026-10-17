// backend/src/routes/auth.ts
import { Router } from 'express';
import {
  sendOtp,
  verifyOtp,
  getSession,
  logout,
  sendSignupOtp,
  verifySignupOtp,
  sendLoginOtp,
  verifyLoginOtp,
  register,
  login,
  requestPasswordReset,
  resetPassword,
} from '../controllers/auth.controller';

const router = Router();

// ─── Resend Direct OTP Endpoints (Native Independent Auth Flow) ───────────────
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.get('/session', getSession);
router.post('/logout', logout);

// ─── Specific Purpose OTP Endpoints ───────────────────────────────────────────
router.post('/send-signup-otp', sendSignupOtp);
router.post('/verify-signup-otp', verifySignupOtp);
router.post('/send-login-otp', sendLoginOtp);
router.post('/verify-login-otp', verifyLoginOtp);

// ─── Nested Legacy Routes (Backward Compatibility) ───────────────────────────
router.post('/otp/send-signup-otp', sendSignupOtp);
router.post('/otp/verify-signup-otp', verifySignupOtp);
router.post('/otp/send-login-otp', sendLoginOtp);
router.post('/otp/verify-login-otp', verifyLoginOtp);

// ─── Standard Auth Endpoints ──────────────────────────────────────────────────
router.post('/register', register);
router.post('/login', login);
router.post('/password-reset-request', requestPasswordReset);
router.post('/password-reset', resetPassword);

export default router;
