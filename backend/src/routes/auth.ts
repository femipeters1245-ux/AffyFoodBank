import { Router } from 'express';
import {
  register,
  login,
  logout,
  sendSignupOtp,
  verifySignupOtp,
  sendLoginOtp,
  verifyLoginOtp,
  requestPasswordReset,
  resetPassword,
  exchangeSupabaseToken,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// ─── Supabase OTP Token Exchange (Primary Auth Method) ─────────────────────────
// Frontend uses Supabase Auth OTP, then exchanges the session token for a backend JWT
router.post('/supabase-exchange', exchangeSupabaseToken);

// ─── One-Time Password (OTP) Authentication (Legacy Resend Email) ──────────────
router.post('/otp/send-signup-otp', sendSignupOtp);
router.post('/otp/verify-signup-otp', verifySignupOtp);
router.post('/otp/send-login-otp', sendLoginOtp);
router.post('/otp/verify-login-otp', verifyLoginOtp);

// ─── Standard Auth Endpoints ──────────────────────────────────────────────────
router.post('/register', register);
router.post('/login', login);
router.post('/password-reset-request', requestPasswordReset);
router.post('/password-reset', resetPassword);

// Protected – logout (requires valid token)
router.post('/logout', authenticate, logout);

export default router;
