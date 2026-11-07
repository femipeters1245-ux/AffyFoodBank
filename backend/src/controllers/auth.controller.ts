// backend/src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  registerUser,
  loginUser,
  logoutUser,
  validateLoginCredentials,
  generateAuthResponseForUser,
  requestPasswordReset as serviceRequestReset,
  resetPassword as serviceResetPassword,
  findUserRecord,
  ensureUserProfileAndWallet,
} from '../services/auth.service';
import { supabaseAdmin, isSupabaseAdminConfigured } from '../services/supabase-admin.service';
import { otpService } from '../services/otp.service';
import { sendWelcomeEmail } from '../services/email.service';
import { extractTokenFromRequest, JwtPayload } from '../middleware/authenticate';
import prisma from '../prisma/client';
import { BadRequestError, ConflictError, UnauthorizedError } from '../utils/errors';

/**
 * Configure secure HttpOnly session cookies for web clients
 */
const setSessionCookies = (res: Response, token: string) => {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  res.cookie('affy_session', token, cookieOptions);
  res.cookie('token', token, cookieOptions);
};

const clearSessionCookies = (res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    path: '/',
  };

  res.clearCookie('affy_session', cookieOptions);
  res.clearCookie('token', cookieOptions);
};

let lastDbErr = 0;
async function safeDbQuery<T>(fn: () => Promise<T>, timeoutMs = 6000): Promise<T | null> {
  if (Date.now() - lastDbErr < 3000) return null;
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      lastDbErr = Date.now();
      resolve(null);
    }, timeoutMs);
  });
  try {
    const res = await Promise.race([fn(), timeoutPromise]);
    return res as T;
  } catch {
    lastDbErr = Date.now();
    return null;
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * POST /api/auth/send-otp
 * Primary unified endpoint to generate and send 6-digit OTP via Resend directly
 */
export const sendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, purpose, firstName, lastName, password } = req.body;
    if (!email) throw new BadRequestError('Email address is required');

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists safely across Prisma and Supabase
    let existingUser = await findUserRecord(normalizedEmail);

    // Determine target purpose: explicitly provided or auto-detected
    const targetPurpose: 'SIGNUP' | 'LOGIN' =
      purpose === 'SIGNUP' || purpose === 'LOGIN'
        ? purpose
        : existingUser
        ? 'LOGIN'
        : 'SIGNUP';

    if (targetPurpose === 'SIGNUP' && existingUser && purpose === 'SIGNUP') {
      throw new ConflictError('An account with this email already exists. Please log in.');
    }

    if (targetPurpose === 'SIGNUP' && password && password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters long');
    }

    const result = await otpService.generateAndSendOtp({
      email: normalizedEmail,
      purpose: targetPurpose,
      firstName: firstName?.trim() || existingUser?.firstName || undefined,
      metadata: {
        email: normalizedEmail,
        password: password || undefined,
        firstName: firstName?.trim() || existingUser?.firstName || undefined,
        lastName: lastName?.trim() || existingUser?.lastName || undefined,
        userId: existingUser?.id,
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify 6-digit OTP independently and establish session with HttpOnly cookie
 */
export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, purpose, verificationTicket, firstName, lastName, password } = req.body;
    if (!email || !otp) throw new BadRequestError('Email and 6-digit verification code are required');

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Verify OTP using durable hashed storage
    const metadata = await otpService.verifyOtp({
      email: normalizedEmail,
      candidateOtp: otp,
      purpose: purpose || 'ANY',
      verificationTicket,
    });

    const userPassword = password || metadata?.password;
    const userFirstName = firstName?.trim() || metadata?.firstName;
    const userLastName = lastName?.trim() || metadata?.lastName;

    // 2. Locate or auto-create user in database
    let user = await findUserRecord(normalizedEmail);

    // Update password if a new password was provided
    if (user && userPassword) {
      try {
        const { hashPassword } = await import('../utils/password');
        const passwordHash = await hashPassword(userPassword);
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
          });
        } catch {}
        if (isSupabaseAdminConfigured && supabaseAdmin) {
          try {
            await supabaseAdmin.from('User').update({ passwordHash }).eq('id', user.id);
          } catch {}
        }
      } catch (pwdErr: any) {
        console.warn('[verifyOtp] Password update note:', pwdErr?.message);
      }
    }

    // Auto-register user + customer profile + wallet if user does not exist yet
    if (!user) {
      const isAdmin = normalizedEmail === 'affybrand@gmail.com' || normalizedEmail === 'admin@affyfoodbank.ng';
      const defaultPwd = userPassword || `Affy-${uuidv4().slice(0, 8)}-${Date.now()}`;
      const { hashPassword } = await import('../utils/password');
      const passwordHash = await hashPassword(defaultPwd);
      const newUserId = uuidv4();
      const profileId = uuidv4();
      const walletId = uuidv4();
      const nowIso = new Date().toISOString();

      try {
        const role = await prisma.role.findFirst({
          where: { name: isAdmin ? 'Admin' : 'Customer' },
        });

        user = await prisma.$transaction(async (tx) => {
          const existing = await tx.user.findUnique({
            where: { email: normalizedEmail },
            include: { profile: true, role: true },
          });
          if (existing) return existing;

          const newUser = await tx.user.create({
            data: {
              id: newUserId,
              email: normalizedEmail,
              passwordHash,
              firstName: userFirstName || normalizedEmail.split('@')[0],
              lastName: userLastName || '',
              roleId: role?.id ?? null,
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

          return await tx.user.findUnique({
            where: { id: newUser.id },
            include: { profile: true, role: true },
          });
        });
      } catch (dbErr: any) {
        console.warn('[verifyOtp] Prisma create note:', dbErr?.message);
      }

      // Supabase fallback for new user creation
      if (!user && isSupabaseAdminConfigured && supabaseAdmin) {
        try {
          const { data: role } = await supabaseAdmin
            .from('Role')
            .select('*')
            .eq('name', isAdmin ? 'Admin' : 'Customer')
            .maybeSingle();

          const { data: createdUser, error: supaCreateErr } = await supabaseAdmin
            .from('User')
            .insert({
              id: newUserId,
              email: normalizedEmail,
              passwordHash,
              firstName: userFirstName || normalizedEmail.split('@')[0],
              lastName: userLastName || '',
              roleId: role?.id ?? null,
              isActive: true,
              createdAt: nowIso,
              updatedAt: nowIso,
            })
            .select()
            .single();

          if (createdUser && !supaCreateErr) {
            await supabaseAdmin.from('CustomerProfile').insert({
              id: profileId,
              userId: createdUser.id,
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

            user = {
              ...createdUser,
              profile: { id: profileId },
              role: role || { name: isAdmin ? 'Admin' : 'Customer' },
            };
          }
        } catch (supaErr: any) {
          console.warn('[verifyOtp] Supabase user registration note:', supaErr?.message);
        }
      }

      // Dispatch welcome email asynchronously
      sendWelcomeEmail({
        to: normalizedEmail,
        firstName: userFirstName || undefined,
      }).catch((e) => console.warn('[Email] Welcome email note:', e?.message));

      console.log(`[verifyOtp] New user account and wallet registered: ${normalizedEmail}`);
    }

    if (user) {
      user = await ensureUserProfileAndWallet(user);
    }

    // Resilient fallback for dev or offline DB
    if (!user) {
      const isAdmin = normalizedEmail === 'affybrand@gmail.com' || normalizedEmail === 'admin@affyfoodbank.ng';
      const syntheticId = metadata?.userId || uuidv4();
      user = {
        id: syntheticId,
        email: normalizedEmail,
        firstName: userFirstName || normalizedEmail.split('@')[0],
        lastName: userLastName || '',
        roleId: isAdmin ? 'admin-role' : 'customer-role',
        role: { name: isAdmin ? 'Admin' : 'Customer' },
        profile: { id: `prof-${syntheticId}` },
        isActive: true,
      };
    }

    if (!user.isActive) {
      throw new BadRequestError('User account has been deactivated. Please contact support.');
    }

    // 3. Issue JWT session token
    const authResponse = await generateAuthResponseForUser(user);

    // 4. Set HttpOnly session cookies
    setSessionCookies(res, authResponse.token);

    // 5. Return authentication payload
    res.json({
      ...authResponse,
      session: {
        userId: user.id,
        email: user.email,
        role: user.role?.name ?? (user.role as any) ?? 'Customer',
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/session
 * Return current session state inspected from HttpOnly cookie or Bearer token
 */
export const getSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      return res.json({ authenticated: false, user: null, session: null });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.json({ authenticated: false, user: null, session: null });
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, secret) as JwtPayload;
    } catch {
      return res.json({ authenticated: false, user: null, session: null });
    }

    // Try to get fresh user profile from Prisma or Supabase
    let user = await findUserRecord(payload.email);

    const userData = user
      ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId,
          role: user.role?.name ?? null,
          profileId: user.profile?.id ?? null,
        }
      : {
          id: payload.sub,
          email: payload.email,
          firstName: payload.email.split('@')[0],
          lastName: '',
          roleId: payload.roleId,
          role: payload.role ?? 'Customer',
          profileId: payload.profileId,
        };

    res.json({
      authenticated: true,
      user: userData,
      session: {
        userId: payload.sub,
        email: payload.email,
        role: payload.role ?? 'Customer',
        exp: payload.exp,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Invalidate session and clear HttpOnly cookies
 */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    clearSessionCookies(res);

    if (req.user?.sub) {
      try {
        await logoutUser(req.user.sub);
      } catch {
        // Ignore user logout token revocation errors
      }
    }

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Legacy / Compatibility Wrappers ──────────────────────────────────────────

export const sendSignupOtp = async (req: Request, res: Response, next: NextFunction) => {
  req.body.purpose = 'SIGNUP';
  return sendOtp(req, res, next);
};

export const verifySignupOtp = async (req: Request, res: Response, next: NextFunction) => {
  req.body.purpose = 'SIGNUP';
  return verifyOtp(req, res, next);
};

export const sendLoginOtp = async (req: Request, res: Response, next: NextFunction) => {
  req.body.purpose = 'LOGIN';
  return sendOtp(req, res, next);
};

export const verifyLoginOtp = async (req: Request, res: Response, next: NextFunction) => {
  req.body.purpose = 'LOGIN';
  return verifyOtp(req, res, next);
};

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
    setSessionCookies(res, token);
    res.json({ token, refreshToken, user });
  } catch (err) {
    next(err);
  }
};

export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await serviceRequestReset(req.body.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await serviceResetPassword(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
