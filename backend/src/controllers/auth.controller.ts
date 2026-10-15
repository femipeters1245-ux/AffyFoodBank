// backend/src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  validateLoginCredentials,
  generateAuthResponseForUser,
  requestPasswordReset as serviceRequestReset,
  resetPassword as serviceResetPassword,
} from '../services/auth.service';
import { otpService } from '../services/otp.service';
import { sendWelcomeEmail } from '../services/email.service';
import { verifySupabaseToken } from '../services/supabase-admin.service';
import prisma from '../prisma/client';
import { BadRequestError, ConflictError } from '../utils/errors';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await registerUser(req.body);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, refreshToken, user } = await loginUser(req.body);
    res.json({ token, refreshToken, user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/otp/send-signup-otp
 * Step 1: Validate registration details and dispatch 6-digit OTP via Resend
 */
export const sendSignupOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email) throw new BadRequestError('Email address is required');
    if (!password || password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters');
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictError('An account with this email already exists. Please log in.');

    const result = await otpService.generateAndSendOtp({
      email,
      purpose: 'SIGNUP',
      firstName,
      metadata: { email, password, firstName, lastName },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/otp/verify-signup-otp
 * Step 2: Verify OTP, create user account + wallet in database, issue JWT session token
 */
export const verifySignupOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, verificationTicket } = req.body;
    if (!email || !otp) throw new BadRequestError('Email and 6-digit OTP code are required');

    // Verify OTP and retrieve stored user metadata
    const metadata = otpService.verifyOtp({
      email,
      candidateOtp: otp,
      purpose: 'SIGNUP',
      verificationTicket,
    });
    if (!metadata) throw new BadRequestError('Invalid or expired verification session.');

    // Create user in database
    const createdUser = await registerUser(metadata);

    // Fetch full user record with profile & role to generate JWT
    const fullUser = await prisma.user.findUnique({
      where: { id: createdUser.id },
      include: { profile: true, role: true },
    });

    const authResponse = await generateAuthResponseForUser(fullUser);

    // Send welcome email asynchronously
    sendWelcomeEmail({
      to: email,
      firstName: createdUser.firstName || undefined,
    }).catch((e) => console.warn('[Email] Welcome email note:', e.message));

    res.status(201).json(authResponse);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/otp/send-login-otp
 * Step 1: Check credentials and dispatch 6-digit OTP via Resend
 */
export const sendLoginOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new BadRequestError('Email and password are required');

    // Validate credentials
    const user = await validateLoginCredentials({ email, password });

    const result = await otpService.generateAndSendOtp({
      email: user.email,
      purpose: 'LOGIN',
      firstName: user.firstName || undefined,
      metadata: { userId: user.id },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/otp/verify-login-otp
 * Step 2: Verify OTP, issue JWT token and complete user login
 */
export const verifyLoginOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, verificationTicket } = req.body;
    if (!email || !otp) throw new BadRequestError('Email and 6-digit OTP code are required');

    const metadata = otpService.verifyOtp({
      email,
      candidateOtp: otp,
      purpose: 'LOGIN',
      verificationTicket,
    });

    const user = await prisma.user.findUnique({
      where: { id: metadata?.userId || undefined, email: !metadata?.userId ? email : undefined },
      include: { profile: true, role: true },
    });

    if (!user || !user.isActive) {
      throw new BadRequestError('User account not found or deactivated.');
    }

    const authResponse = await generateAuthResponseForUser(user);
    res.json(authResponse);
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await logoutUser(req.user!.sub);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/supabase-exchange
 * Exchange a verified Supabase Auth access_token for a backend JWT.
 * Called after frontend successfully verifies Supabase OTP.
 * Automatically creates the user in our DB if they don't exist yet.
 */
export const exchangeSupabaseToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { access_token, firstName, lastName } = req.body;
    if (!access_token) throw new BadRequestError('Supabase access_token is required');

    // 1. Verify the Supabase token server-side
    const supabaseUser = await verifySupabaseToken(access_token);
    if (!supabaseUser?.email) {
      throw new BadRequestError('Invalid or expired Supabase session. Please sign in again.');
    }

    const email = supabaseUser.email.trim().toLowerCase();

    // 2. Find existing user or create a new one
    let user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true, role: true },
    });

    if (!user) {
      // Auto-register: create user + profile + wallet
      const customerRole = await prisma.role.findFirst({ where: { name: 'Customer' } });
      const { v4: uuidv4 } = await import('uuid');
      const { hashPassword } = await import('../utils/password');

      // Generate a secure random password hash (user won't use it — auth is via Supabase OTP)
      const randomPwd = `SupaOTP-${supabaseUser.id.slice(0, 8)}-${Date.now()}`;
      const passwordHash = await hashPassword(randomPwd);

      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            id: uuidv4(),
            email,
            passwordHash,
            firstName: firstName?.trim() || null,
            lastName: lastName?.trim() || null,
            roleId: customerRole?.id ?? null,
          },
        });

        const profile = await tx.customerProfile.create({
          data: { id: uuidv4(), userId: newUser.id },
        });

        await tx.wallet.create({
          data: {
            id: uuidv4(),
            customerProfileId: profile.id,
            totalBalanceCents: 0,
            allocatedToSavingsCents: 0,
            currency: 'NGN',
            status: 'ACTIVE',
          },
        });

        return await tx.user.findUnique({
          where: { id: newUser.id },
          include: { profile: true, role: true },
        });
      }) as any;

      // Send welcome email asynchronously
      sendWelcomeEmail({ to: email, firstName: firstName?.trim() || undefined })
        .catch((e) => console.warn('[Email] Welcome email note:', e.message));

      console.log(`[SupabaseExchange] New user auto-registered: ${email}`);
    } else if (!user.isActive) {
      throw new BadRequestError('Your account has been deactivated. Please contact support.');
    }

    // 3. Generate backend JWT
    const authResponse = await generateAuthResponseForUser(user);
    console.log(`[SupabaseExchange] JWT issued for: ${email}`);

    res.json(authResponse);
  } catch (err) {
    next(err);
  }
};

export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await serviceRequestReset(req.body.email);
    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await serviceResetPassword(req.body.token, req.body.newPassword);
    res.json({ message: 'Password has been reset' });
  } catch (err) {
    next(err);
  }
};
