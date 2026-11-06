import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { hashPassword, comparePassword } from '../utils/password';
import { seedDemoAccounts } from '../seeders/seedRolesPermissions';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../utils/errors';
import { z } from 'zod';
import { otpService } from './otp.service';

// ─── Validation Schemas ────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Load all permission strings for a given role.
 * Returns an empty array if roleId is null.
 */
async function loadPermissions(roleId: string | null): Promise<string[]> {
  if (!roleId) return [];
  try {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), 1000);
    });
    const query = prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    const rolePerms = await Promise.race([query, timeoutPromise]).finally(() => clearTimeout(timer));
    return rolePerms.map((rp) => `${rp.permission.action}:${rp.permission.resource}`);
  } catch {
    return [];
  }
}

/**
 * Sign a short-lived access JWT (7d default, configurable via JWT_EXPIRES_IN).
 */
function signAccessToken(payload: object): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required. Cannot sign access tokens without it.');
  }
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, secret, { expiresIn });
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Register a new customer.
 * - Hashes the password with bcrypt.
 * - Assigns the default 'Customer' role.
 * - Creates a CustomerProfile and a Wallet atomically.
 */
export async function registerUser(body: unknown) {
  const { email, password, firstName, lastName } = registerSchema.parse(body);

  // Prevent duplicate accounts
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError('Email already in use');

  // Find the default Customer role (seeded)
  const customerRole = await prisma.role.findFirst({ where: { name: 'Customer' } });

  const passwordHash = await hashPassword(password);

  // Create user + profile + wallet in one transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        id: uuidv4(),
        email,
        passwordHash,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        roleId: customerRole?.id ?? null,
      },
    });

    const profile = await tx.customerProfile.create({
      data: {
        id: uuidv4(),
        userId: newUser.id,
      },
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

    return newUser;
  });

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

/**
 * Authenticate an existing user.
 * Returns a signed JWT access token plus basic user info.
 */
export async function loginUser(body: unknown) {
  const { email, password } = loginSchema.parse(body);

  let user: any = null;
  try {
    user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true, role: true },
    });
  } catch (dbErr: any) {
    console.warn('[loginUser] Database connection note:', dbErr?.message);
  }

  // Self-healing: If demo user does not exist yet in database, auto-seed demo accounts
  const isDemoEmail =
    email === 'affybrand@gmail.com' ||
    email === 'admin@affyfoodbank.ng' ||
    email === 'customer@affyfoodbank.ng' ||
    email === 'staff@affyfoodbank.ng';

  if (!user && isDemoEmail) {
    try {
      await seedDemoAccounts();
      user = await prisma.user.findUnique({
        where: { email },
        include: { profile: true, role: true },
      });
    } catch (seedErr) {
      console.error('Error auto-seeding demo accounts:', seedErr);
    }
  }

  // If user found in database, verify password
  if (user && user.isActive) {
    const valid = await comparePassword(password, user.passwordHash);
    if (valid) {
      const permissions = await loadPermissions(user.roleId);
      const payload = {
        sub: user.id,
        email: user.email,
        roleId: user.roleId,
        role: user.role?.name ?? null,
        profileId: user.profile?.id ?? null,
        permissions,
      };
      const token = signAccessToken(payload);
      return {
        token,
        refreshToken: null,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId,
          role: user.role?.name ?? null,
        },
      };
    }
  }

  throw new UnauthorizedError('Invalid email or password');
}

/**
 * Validate user credentials without issuing token (step 1 of OTP login)
 */
export async function validateLoginCredentials(body: unknown) {
  const { email, password } = loginSchema.parse(body);

  let user: any = null;
  try {
    user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true, role: true },
    });
  } catch (dbErr: any) {
    console.warn('[validateLoginCredentials] DB note:', dbErr?.message);
  }

  const isDemoEmail =
    email === 'affybrand@gmail.com' ||
    email === 'admin@affyfoodbank.ng' ||
    email === 'customer@affyfoodbank.ng' ||
    email === 'staff@affyfoodbank.ng';

  if (!user && isDemoEmail) {
    try {
      await seedDemoAccounts();
      user = await prisma.user.findUnique({
        where: { email },
        include: { profile: true, role: true },
      });
    } catch (seedErr) {
      console.error('Error auto-seeding demo accounts:', seedErr);
    }
  }

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  return user;
}

/**
 * Generate JWT token and auth response for a verified user (step 2 of OTP login/register)
 */
export async function generateAuthResponseForUser(user: any) {
  const permissions = await loadPermissions(user.roleId);

  const payload = {
    sub: user.id,
    email: user.email,
    roleId: user.roleId,
    role: user.role?.name ?? null,
    profileId: user.profile?.id ?? null,
    permissions,
  };

  const token = signAccessToken(payload);

  return {
    token,
    refreshToken: null,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      role: user.role?.name ?? null,
    },
  };
}

/**
 * Logout – stateless; client discards the token.
 * Placeholder for future refresh-token revocation.
 */
export async function logoutUser(_userId: string): Promise<void> {
  // Nothing to do for stateless JWT.
  // If a token blacklist / refresh-token table is added, revoke here.
}

/**
 * Send a 6-digit password reset OTP via Resend.
 * Always resolves gracefully to avoid account enumeration.
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  if (!email) throw new BadRequestError('Email is required');
  const normalizedEmail = email.trim().toLowerCase();

  let user: any = null;
  try {
    user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  } catch (err: any) {
    console.warn('[requestPasswordReset] DB check note:', err?.message);
  }

  if (user && user.isActive) {
    try {
      await otpService.generateAndSendOtp({
        email: normalizedEmail,
        purpose: 'PASSWORD_RESET',
        firstName: user.firstName || 'there',
        metadata: { userId: user.id },
      });
    } catch (err: any) {
      if (err instanceof BadRequestError) throw err;
      console.error('[requestPasswordReset] Error sending OTP:', err?.message);
    }
  }

  return {
    success: true,
    message: 'If that email address is registered, a 6-digit password reset code has been sent.',
  };
}

/**
 * Apply a password reset using the 6-digit OTP code sent via Resend.
 */
export async function resetPassword(body: { email?: string; otp?: string; token?: string; newPassword?: string; password?: string }): Promise<{ success: boolean; message: string }> {
  const email = body.email;
  const otp = body.otp || body.token;
  const newPassword = body.newPassword || body.password;

  if (!email || !otp || !newPassword) {
    throw new BadRequestError('Email address, 6-digit code, and new password are required');
  }
  if (newPassword.length < 8) {
    throw new BadRequestError('New password must be at least 8 characters long');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Verify OTP from durable store
  await otpService.verifyOtp({
    email: normalizedEmail,
    candidateOtp: otp.trim(),
    purpose: 'PASSWORD_RESET',
  });

  // Hash new password and update user record
  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { email: normalizedEmail },
    data: { passwordHash },
  });

  return {
    success: true,
    message: 'Your password has been reset successfully. You can now log in with your new password.',
  };
}
