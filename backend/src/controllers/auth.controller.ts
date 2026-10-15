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
    const { email, otp } = req.body;
    if (!email || !otp) throw new BadRequestError('Email and 6-digit OTP code are required');

    // Verify OTP and retrieve stored user metadata
    const metadata = otpService.verifyOtp(email, otp, 'SIGNUP');
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
    const { email, otp } = req.body;
    if (!email || !otp) throw new BadRequestError('Email and 6-digit OTP code are required');

    const metadata = otpService.verifyOtp(email, otp, 'LOGIN');

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

export const seedDemo = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { seedDemoAccounts } = await import('../seeders/seedRolesPermissions');
    await seedDemoAccounts();
    res.json({
      message: 'Demo accounts and roles seeded successfully',
      accounts: [
        { email: 'customer@affyfoodbank.ng', role: 'Customer', password: 'Password123!' },
        { email: 'staff@affyfoodbank.ng', role: 'FinanceStaff', password: 'StaffPassword123!' },
        { email: 'affybrand@gmail.com', role: 'Admin', password: 'AdminPassword123!' },
        { email: 'admin@affyfoodbank.ng', role: 'Admin', password: 'AdminPassword123!' },
      ],
    });
  } catch (err) {
    next(err);
  }
};
