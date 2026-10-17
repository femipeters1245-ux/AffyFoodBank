// backend/src/__tests__/otp-auth.test.ts
import request from 'supertest';
import app from '../app';
import { durableOtpStore, hashOtp, verifyOtpHash } from '../services/durable-otp.store';
import { otpService } from '../services/otp.service';

// Mock Resend to test pure backend logic without consuming email credits
jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({
          data: { id: 'mock-resend-id-' + Date.now() },
          error: null,
        }),
      },
    })),
  };
});

describe('Direct Resend OTP & Session Authentication System', () => {
  const testEmail = 'otp.test.user@affyfoodbank.ng';

  beforeEach(() => {
    // Set required environment variables for test
    process.env.JWT_SECRET = 'test-secret-for-jwt-signing-and-otp-hashing-32-chars';
    process.env.RESEND_API_KEY = 're_test_dummy_key_for_testing';
    process.env.RESEND_FROM_EMAIL = 'Affy FoodBank <test@affyfoodbank.com.ng>';
  });

  describe('1. OTP Generation, Hashing and Durable Storage', () => {
    it('should generate a secure 6-digit numeric OTP and store only its hash', async () => {
      const email = `hash-test-${Date.now()}@example.com`;
      const res = await otpService.generateAndSendOtp({
        email,
        purpose: 'LOGIN',
        firstName: 'Tester',
      });

      expect(res.success).toBe(true);
      expect(res.expiresInMinutes).toBe(5);
      expect(res.cooldownSeconds).toBe(60);

      const record = await durableOtpStore.getLatestActiveOtp(email, 'LOGIN');
      expect(record).toBeDefined();
      expect(record).not.toBeNull();
      // Ensure raw plaintext OTP is NEVER stored in durable storage
      expect(record!.hashedOtp).toHaveLength(64); // SHA-256 hex string
      expect(/^\d{6}$/.test(record!.hashedOtp)).toBe(false);
      expect(record!.attempts).toBe(0);
      expect(record!.maxAttempts).toBe(5);
    });

    it('should accurately verify correct hash and reject incorrect candidate OTP', () => {
      const email = 'crypto.test@example.com';
      const realOtp = '849201';
      const fakeOtp = '123456';

      const hashed = hashOtp(email, realOtp);
      expect(verifyOtpHash(email, realOtp, hashed)).toBe(true);
      expect(verifyOtpHash(email, fakeOtp, hashed)).toBe(false);
      expect(verifyOtpHash('wrong.email@example.com', realOtp, hashed)).toBe(false);
    });
  });

  describe('2. Resend Cooldown Enforcement', () => {
    it('should reject a second OTP request before the 60-second cooldown expires', async () => {
      const email = `cooldown-${Date.now()}@example.com`;

      // First OTP request - should succeed
      const first = await otpService.generateAndSendOtp({ email, purpose: 'LOGIN' });
      expect(first.success).toBe(true);

      // Immediate second OTP request - should be blocked by cooldown
      await expect(
        otpService.generateAndSendOtp({ email, purpose: 'LOGIN' })
      ).rejects.toThrow(/Please wait \d+ seconds? before requesting another verification code/i);
    });
  });

  describe('3. Five-Minute Expiration Enforcement', () => {
    it('should reject OTP verification after the 5-minute expiration period', async () => {
      const email = `expired-${Date.now()}@example.com`;
      const otp = '654321';
      const hashedOtp = hashOtp(email, otp);

      // Manually save an OTP that expired 1 second ago
      await durableOtpStore.saveOtp({
        email,
        hashedOtp,
        purpose: 'LOGIN',
        expiresAt: new Date(Date.now() - 1000), // Expired
        resendAfter: new Date(Date.now() - 2000),
      });

      await expect(
        otpService.verifyOtp({ email, candidateOtp: otp, purpose: 'LOGIN' })
      ).rejects.toThrow(/Verification code has expired/i);
    });
  });

  describe('4. Verification Attempt Limits', () => {
    it('should track failed attempts and revoke code after 5 wrong tries', async () => {
      const email = `attempts-${Date.now()}@example.com`;
      const correctOtp = '789012';
      const wrongOtp = '000000';
      const hashedOtp = hashOtp(email, correctOtp);

      await durableOtpStore.saveOtp({
        email,
        hashedOtp,
        purpose: 'LOGIN',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        resendAfter: new Date(Date.now() + 60 * 1000),
      });

      // Try 1-4 wrong attempts: should return remaining attempts
      for (let i = 1; i <= 4; i++) {
        await expect(
          otpService.verifyOtp({ email, candidateOtp: wrongOtp, purpose: 'LOGIN' })
        ).rejects.toThrow(new RegExp(`Incorrect verification code\\. You have ${5 - i} attempt`, 'i'));
      }

      // 5th wrong attempt: should revoke code
      await expect(
        otpService.verifyOtp({ email, candidateOtp: wrongOtp, purpose: 'LOGIN' })
      ).rejects.toThrow(/Too many failed verification attempts\. This code has been revoked/i);

      // Even correct OTP should now fail because code was revoked
      await expect(
        otpService.verifyOtp({ email, candidateOtp: correctOtp, purpose: 'LOGIN' })
      ).rejects.toThrow(/Verification code has expired or was not requested/i);
    });
  });

  describe('5. HTTP API Endpoints (/api/auth/send-otp, verify-otp, session, logout)', () => {
    const apiEmail = `api-test-${Date.now()}@affyfoodbank.ng`;
    const knownOtp = '583921';

    it('POST /api/auth/send-otp: should dispatch OTP and return cooldown info', async () => {
      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({
          email: apiEmail,
          purpose: 'SIGNUP',
          firstName: 'Chidi',
          lastName: 'Okonkwo',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.expiresInMinutes).toBe(5);
      expect(res.body.cooldownSeconds).toBe(60);
      expect(res.body.message).toMatch(/6-digit verification code has been sent/i);
    });

    it('POST /api/auth/verify-otp: should verify OTP, set HttpOnly cookie and issue token', async () => {
      const verifyEmail = `verify-http-${Date.now()}@affyfoodbank.ng`;
      const fixedOtp = '419283';

      // Seed durable store directly with known OTP hash
      await durableOtpStore.saveOtp({
        email: verifyEmail,
        hashedOtp: hashOtp(verifyEmail, fixedOtp),
        purpose: 'SIGNUP',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        resendAfter: new Date(Date.now() + 60 * 1000),
        metadata: { firstName: 'Amaka', lastName: 'Eze' },
      });

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          email: verifyEmail,
          otp: fixedOtp,
          purpose: 'SIGNUP',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(verifyEmail);

      // Verify HttpOnly cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
      expect(cookieStr).toMatch(/affy_session=/);
      expect(cookieStr.toLowerCase()).toMatch(/httponly/);
    });

    it('GET /api/auth/session: should authenticate user via HttpOnly cookie', async () => {
      const sessionEmail = `session-${Date.now()}@affyfoodbank.ng`;
      const fixedOtp = '112233';

      await durableOtpStore.saveOtp({
        email: sessionEmail,
        hashedOtp: hashOtp(sessionEmail, fixedOtp),
        purpose: 'LOGIN',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        resendAfter: new Date(Date.now() + 60 * 1000),
      });

      // Verify OTP to get session cookie
      const loginRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: sessionEmail, otp: fixedOtp });

      const cookieHeader = loginRes.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();

      // Access /api/auth/session using the HttpOnly cookie (without Authorization header)
      const sessionRes = await request(app)
        .get('/api/auth/session')
        .set('Cookie', cookieHeader);

      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.authenticated).toBe(true);
      expect(sessionRes.body.user.email).toBe(sessionEmail);
    });

    it('POST /api/auth/logout: should clear HttpOnly session cookies', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
      // Expired cookie instruction
      expect(cookieStr).toMatch(/affy_session=;/);
    });

    it('Protected routes: should authenticate using HttpOnly cookie without Bearer header', async () => {
      const authEmail = `protected-${Date.now()}@affyfoodbank.ng`;
      const fixedOtp = '998877';

      await durableOtpStore.saveOtp({
        email: authEmail,
        hashedOtp: hashOtp(authEmail, fixedOtp),
        purpose: 'LOGIN',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        resendAfter: new Date(Date.now() + 60 * 1000),
      });

      const loginRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: authEmail, otp: fixedOtp });

      const cookieHeader = loginRes.headers['set-cookie'];

      // Access protected route /api/v1/wallet using ONLY the HttpOnly cookie
      const walletRes = await request(app)
        .get('/api/v1/wallet')
        .set('Cookie', cookieHeader);

      // Verify request was NOT rejected with 401 Unauthorized
      expect(walletRes.status).not.toBe(401);
    });
  });
});
