import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { hashPassword, comparePassword } from '../utils/password';
import { seedDemoAccounts } from '../seeders/seedRolesPermissions';
import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase-admin.service';
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
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

let lastPrismaErrorTime = 0;
async function safePrismaQuery<T>(fn: () => Promise<T>, timeoutMs = 1500): Promise<T | null> {
  // Circuit breaker: If Prisma failed within 30s, fail fast and allow Supabase fallback immediately
  if (Date.now() - lastPrismaErrorTime < 30000) return null;
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      lastPrismaErrorTime = Date.now();
      resolve(null);
    }, timeoutMs);
  });
  try {
    const res = await Promise.race([fn(), timeoutPromise]);
    return res as T;
  } catch {
    lastPrismaErrorTime = Date.now();
    return null;
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Resilient user lookup across Prisma and Supabase cloud database
 */
export async function findUserRecord(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Attempt Prisma lookup first (with circuit breaker)
  const user = await safePrismaQuery(() =>
    prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true, role: true },
    })
  );
  if (user) return user;

  // 2. Attempt Supabase lookup
  if (isSupabaseAdminConfigured && supabaseAdmin) {
    try {
      const { data: supaUser, error: uErr } = await supabaseAdmin
        .from('User')
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (supaUser && !uErr) {
        // Fetch profile
        const { data: profile } = await supabaseAdmin
          .from('CustomerProfile')
          .select('*')
          .eq('userId', supaUser.id)
          .maybeSingle();

        // Fetch role
        let role: any = null;
        if (supaUser.roleId) {
          const { data: roleData } = await supabaseAdmin
            .from('Role')
            .select('*')
            .eq('id', supaUser.roleId)
            .maybeSingle();
          role = roleData;
        }

        return {
          ...supaUser,
          profile,
          role,
        };
      }
    } catch (supaErr: any) {
      console.warn('[findUserRecord] Supabase DB lookup note:', supaErr?.message);
    }
  }

  return null;
}

/**
 * Ensure user has an attached CustomerProfile and active Wallet in database
 */
export async function ensureUserProfileAndWallet(user: any) {
  if (user.profile && user.profile.id) {
    return user;
  }

  const profileId = uuidv4();
  const walletId = uuidv4();
  const nowIso = new Date().toISOString();

  if (isSupabaseAdminConfigured && supabaseAdmin) {
    try {
      const { data: existingProf } = await supabaseAdmin
        .from('CustomerProfile')
        .select('*')
        .eq('userId', user.id)
        .maybeSingle();

      if (existingProf) {
        user.profile = existingProf;
        return user;
      }

      const { data: newProf, error: pErr } = await supabaseAdmin
        .from('CustomerProfile')
        .insert({
          id: profileId,
          userId: user.id,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .select()
        .single();

      if (newProf && !pErr) {
        user.profile = newProf;

        // Ensure wallet
        await supabaseAdmin.from('Wallet').insert({
          id: walletId,
          customerProfileId: newProf.id,
          totalBalanceCents: 0,
          allocatedToSavingsCents: 0,
          currency: 'NGN',
          status: 'ACTIVE',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    } catch (err: any) {
      console.warn('[ensureUserProfileAndWallet] note:', err?.message);
    }
  }

  if (!user.profile) {
    user.profile = { id: `prof-${user.id}` };
  }

  return user;
}

/**
 * Load all permission strings for a given role.
 * Returns an empty array if roleId is null.
 */
async function loadPermissions(roleId: string | null, roleName?: string | null): Promise<string[]> {
  if (roleName === 'Admin' || roleName === 'SuperAdmin') {
    return ['*:*'];
  }
  if (!roleId) return [];

  // 1. Try Prisma (fast fail if offline)
  const rolePerms = await safePrismaQuery(() =>
    prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    })
  );
  if (rolePerms && rolePerms.length > 0) {
    return rolePerms.map((rp) => `${rp.permission.action}:${rp.permission.resource}`);
  }

  // 2. Try Supabase
  if (isSupabaseAdminConfigured && supabaseAdmin) {
    try {
      const { data: rps } = await supabaseAdmin
        .from('RolePermission')
        .select('permission:Permission(*)')
        .eq('roleId', roleId);

      if (rps && rps.length > 0) {
        return rps
          .filter((rp: any) => rp.permission)
          .map((rp: any) => `${rp.permission.action}:${rp.permission.resource}`);
      }
    } catch {}
  }

  // Fallback defaults for Customer
  if (roleName === 'Customer') {
    return [
      'auth:login',
      'auth:register',
      'product:read',
      'wallet:read',
      'wallet:deposit',
      'wallet:withdraw',
      'wallet:allocate',
      'wallet:release',
      'order:create',
      'order:read',
      'savings:create',
      'savings:read',
      'savings:cancel',
      'package:read',
    ];
  }

  return [];
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
  const normalizedEmail = email.trim().toLowerCase();

  // Prevent duplicate accounts
  const existing = await findUserRecord(normalizedEmail);
  if (existing) throw new ConflictError('Email already in use');

  const passwordHash = await hashPassword(password);
  const userId = uuidv4();
  const profileId = uuidv4();
  const walletId = uuidv4();
  const nowIso = new Date().toISOString();

  // Try Prisma first
  try {
    const customerRole = await prisma.role.findFirst({ where: { name: 'Customer' } });
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          id: userId,
          email: normalizedEmail,
          passwordHash,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          roleId: customerRole?.id ?? null,
        },
      });

      const profile = await tx.customerProfile.create({
        data: {
          id: profileId,
          userId: newUser.id,
        },
      });

      await tx.wallet.create({
        data: {
          id: walletId,
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
  } catch (dbErr: any) {
    console.warn('[registerUser] Prisma transaction note:', dbErr?.message);
  }

  // Fallback: Register directly in Supabase cloud database
  if (isSupabaseAdminConfigured && supabaseAdmin) {
    const { data: role } = await supabaseAdmin.from('Role').select('*').eq('name', 'Customer').maybeSingle();

    const { data: newUser, error: uErr } = await supabaseAdmin.from('User').insert({
      id: userId,
      email: normalizedEmail,
      passwordHash,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      roleId: role?.id ?? null,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    }).select().single();

    if (uErr) {
      throw new BadRequestError('Failed to create user account: ' + uErr.message);
    }

    await supabaseAdmin.from('CustomerProfile').insert({
      id: profileId,
      userId: newUser.id,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await supabaseAdmin.from('Wallet').insert({
      id: walletId,
      customerProfileId: profileId,
      totalBalanceCents: 0,
      allocatedToSavingsCents: 0,
      currency: 'NGN',
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    return {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
    };
  }

  throw new BadRequestError('Unable to complete registration. Database service is unavailable.');
}

/**
 * Authenticate an existing user.
 * Returns a signed JWT access token plus basic user info.
 */
export async function loginUser(body: unknown) {
  const { email, password } = loginSchema.parse(body);
  const normalizedEmail = email.trim().toLowerCase();

  let user = await findUserRecord(normalizedEmail);

  // Self-healing: If demo user does not exist yet in database, auto-seed demo accounts
  const isDemoEmail =
    normalizedEmail === 'affybrand@gmail.com' ||
    normalizedEmail === 'admin@affyfoodbank.ng' ||
    normalizedEmail === 'customer@affyfoodbank.ng' ||
    normalizedEmail === 'staff@affyfoodbank.ng';

  if (!user && isDemoEmail) {
    try {
      await seedDemoAccounts();
      user = await findUserRecord(normalizedEmail);
    } catch (seedErr) {
      console.error('Error auto-seeding demo accounts:', seedErr);
    }
  }

  // 1. If user found in database, verify password with bcrypt
  if (user && user.isActive) {
    const valid = await comparePassword(password, user.passwordHash);
    if (valid) {
      user = await ensureUserProfileAndWallet(user);
      const permissions = await loadPermissions(user.roleId, user.role?.name);
      const payload = {
        sub: user.id,
        email: user.email,
        roleId: user.roleId,
        role: user.role?.name ?? 'Customer',
        profileId: user.profile?.id ?? `prof-${user.id}`,
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
          role: user.role?.name ?? 'Customer',
        },
      };
    }
  }

  // 2. Fallback: Verify against Supabase Auth (for users created/synced with Supabase Auth)
  if (isSupabaseAdminConfigured && supabaseAdmin) {
    try {
      const { data: supaAuth, error: supaErr } = await supabaseAdmin.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!supaErr && supaAuth?.user) {
        const supaUser = supaAuth.user;
        const isAdmin = normalizedEmail === 'affybrand@gmail.com' || normalizedEmail === 'admin@affyfoodbank.ng';
        const roleName = isAdmin ? 'Admin' : 'Customer';
        const permissions = isAdmin ? ['*:*'] : ['auth:login', 'product:read', 'wallet:read', 'order:create', 'order:read'];

        let dbUser = await findUserRecord(normalizedEmail);
        if (!dbUser) {
          try {
            const { data: role } = await supabaseAdmin.from('Role').select('*').eq('name', roleName).maybeSingle();
            const { hashPassword } = await import('../utils/password');
            const passwordHash = await hashPassword(password);
            const { data: createdUser } = await supabaseAdmin.from('User').insert({
              id: supaUser.id,
              email: normalizedEmail,
              passwordHash,
              firstName: supaUser.user_metadata?.first_name || normalizedEmail.split('@')[0],
              lastName: supaUser.user_metadata?.last_name || '',
              roleId: role?.id ?? null,
              isActive: true,
            }).select().single();
            dbUser = createdUser;
          } catch {}
        }

        if (dbUser) {
          dbUser = await ensureUserProfileAndWallet(dbUser);
        }

        const payload = {
          sub: supaUser.id,
          email: supaUser.email,
          roleId: dbUser?.roleId || (isAdmin ? 'admin-role' : 'customer-role'),
          role: roleName,
          profileId: dbUser?.profile?.id || `prof-${supaUser.id}`,
          permissions,
        };
        const token = signAccessToken(payload);
        return {
          token,
          refreshToken: null,
          user: {
            id: supaUser.id,
            email: supaUser.email,
            firstName: dbUser?.firstName || supaUser.user_metadata?.first_name || normalizedEmail.split('@')[0],
            lastName: dbUser?.lastName || supaUser.user_metadata?.last_name || '',
            roleId: dbUser?.roleId || (isAdmin ? 'admin-role' : 'customer-role'),
            role: roleName,
          },
        };
      }
    } catch (supaErr: any) {
      console.warn('[loginUser] Supabase Auth check note:', supaErr?.message);
    }
  }

  throw new UnauthorizedError('Invalid email or password');
}

/**
 * Validate user credentials without issuing token (step 1 of OTP login)
 */
export async function validateLoginCredentials(body: unknown) {
  const { email, password } = loginSchema.parse(body);
  const normalizedEmail = email.trim().toLowerCase();

  let user = await findUserRecord(normalizedEmail);

  const isDemoEmail =
    normalizedEmail === 'affybrand@gmail.com' ||
    normalizedEmail === 'admin@affyfoodbank.ng' ||
    normalizedEmail === 'customer@affyfoodbank.ng' ||
    normalizedEmail === 'staff@affyfoodbank.ng';

  if (!user && isDemoEmail) {
    try {
      await seedDemoAccounts();
      user = await findUserRecord(normalizedEmail);
    } catch (seedErr) {
      console.error('Error auto-seeding demo accounts:', seedErr);
    }
  }

  if (user && user.isActive) {
    const valid = await comparePassword(password, user.passwordHash);
    if (valid) {
      return await ensureUserProfileAndWallet(user);
    }
  }

  // Supabase Auth fallback
  if (isSupabaseAdminConfigured && supabaseAdmin) {
    try {
      const { data: supaAuth, error: supaErr } = await supabaseAdmin.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (!supaErr && supaAuth?.user) {
        if (!user) {
          user = {
            id: supaAuth.user.id,
            email: normalizedEmail,
            firstName: supaAuth.user.user_metadata?.first_name || normalizedEmail.split('@')[0],
            lastName: supaAuth.user.user_metadata?.last_name || '',
            isActive: true,
          };
        }
        return await ensureUserProfileAndWallet(user);
      }
    } catch {}
  }

  throw new UnauthorizedError('Invalid email or password');
}

/**
 * Generate JWT token and auth response for a verified user (step 2 of OTP login/register)
 */
export async function generateAuthResponseForUser(user: any) {
  const permissions = await loadPermissions(user.roleId, user.role?.name);

  const payload = {
    sub: user.id,
    email: user.email,
    roleId: user.roleId,
    role: user.role?.name ?? 'Customer',
    profileId: user.profile?.id ?? `prof-${user.id}`,
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
      role: user.role?.name ?? 'Customer',
    },
  };
}

/**
 * Logout – stateless; client discards the token.
 */
export async function logoutUser(_userId: string): Promise<void> {
  // Stateless JWT – no revocation table needed
}

/**
 * Send a 6-digit password reset OTP via Resend.
 * Always resolves gracefully to avoid account enumeration.
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  if (!email) throw new BadRequestError('Email is required');
  const normalizedEmail = email.trim().toLowerCase();

  const user = await findUserRecord(normalizedEmail);

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

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update in Prisma if possible
  try {
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { passwordHash },
    });
  } catch (err: any) {
    console.warn('[resetPassword] Prisma update note:', err?.message);
  }

  // Update in Supabase cloud database
  if (isSupabaseAdminConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin
        .from('User')
        .update({ passwordHash, updatedAt: new Date().toISOString() })
        .ilike('email', normalizedEmail);
    } catch (supaErr: any) {
      console.warn('[resetPassword] Supabase update note:', supaErr?.message);
    }

    // Also update in Supabase Auth if the user exists there
    try {
      const { data: supaUsers } = await supabaseAdmin.auth.admin.listUsers();
      const match = supaUsers?.users?.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
      if (match) {
        await supabaseAdmin.auth.admin.updateUserById(match.id, { password: newPassword });
      }
    } catch (authErr: any) {
      console.warn('[resetPassword] Supabase Auth password sync note:', authErr?.message);
    }
  }

  return {
    success: true,
    message: 'Your password has been reset successfully. You can now log in with your new password.',
  };
}
