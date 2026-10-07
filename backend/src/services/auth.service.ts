// backend/src/services/auth.service.ts
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { hashPassword, comparePassword } from '../utils/password';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../utils/errors';
import { z } from 'zod';

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
  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });
  return rolePerms.map((rp) => `${rp.permission.action}:${rp.permission.resource}`);
}

/**
 * Sign a short-lived access JWT (7d default, configurable via JWT_EXPIRES_IN).
 */
function signAccessToken(payload: object): string {
  const secret = process.env.JWT_SECRET!;
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

  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  const permissions = await loadPermissions(user.roleId);

  const payload = {
    sub: user.id,
    email: user.email,
    roleId: user.roleId,
    profileId: user.profile?.id ?? null,
    permissions,
  };

  const token = signAccessToken(payload);

  return {
    token,
    refreshToken: null, // stateless JWT – add refresh token flow later
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
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
 * Send a password reset link.
 * Currently a stub — returns successfully regardless (avoids enumeration).
 * Wire up a real email provider (Nodemailer / SendGrid) here.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!email) throw new BadRequestError('Email is required');
  // Always resolve to avoid leaking whether an account exists.
  // TODO: generate a signed reset token, persist it, send email.
}

/**
 * Apply a password reset using the signed token from the email link.
 * Currently a stub.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!token || !newPassword) {
    throw new BadRequestError('Token and new password are required');
  }
  if (newPassword.length < 8) {
    throw new BadRequestError('Password must be at least 8 characters');
  }
  // TODO: verify token signature, look up user, hash & save new password.
  throw new BadRequestError('Password reset is not yet implemented');
}
