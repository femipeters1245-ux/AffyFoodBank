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
} from '../services/auth.service';
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
async function safeDbQuery<T>(fn: () => Promise<T>, timeoutMs = 1500): Promise<T | null> {
  if (Date.now() - lastDbErr < 15000) return null;
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

    // Check if user already exists safely
    let existingUser: any = null;
    try {
      existingUser = await safeDbQuery(() =>
        prisma.user.findUnique({ where: { email: normalizedEmail } })
      );
    } catch (dbErr: any) {
      console.warn('[sendOtp] User check note:', dbErr?.message);
    }

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
    let user: any = null;
    try {
      user = await safeDbQuery(() =>
        prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: { profile: true, role: true },
        })
      );

      // Update password if a new password was provided
      if (user && userPassword) {
        try {
          const { hashPassword } = await import('../utils/password');
          const passwordHash = await hashPassword(userPassword);
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
          });
        } catch (pwdErr: any) {
          console.warn('[verifyOtp] Password update note:', pwdErr?.message);
        }
      }

      // Auto-register user + customer profile + wallet if user does not exist yet
      if (!user) {
        const isAdmin = normalizedEmail === 'affybrand@gmail.com' || normalizedEmail === 'admin@affyfoodbank.ng';
        const role = await prisma.role.findFirst({
          where: { name: isAdmin ? 'Admin' : 'Customer' },
        });

        const { hashPassword } = await import('../utils/password');
        const defaultPwd = userPassword || `Affy-${uuidv4().slice(0, 8)}-${Date.now()}`;
        const passwordHash = await hashPassword(defaultPwd);

        user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              id: uuidv4(),
              email: normalizedEmail,
              passwordHash,
              firstName: userFirstName || normalizedEmail.split('@')[0],
              lastName: userLastName || '',
              roleId: role?.id ?? null,
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

          return await tx.user.findUnique({
            where: { id: newUser.id },
            include: { profile: true, role: true },
          });
        });

        // Dispatch welcome email asynchronously
        sendWelcomeEmail({
          to: normalizedEmail,
          firstName: userFirstName || undefined,
        }).catch((e) => console.warn('[Email] Welcome email note:', e?.message));

        console.log(`[verifyOtp] New user account and wallet registered: ${normalizedEmail}`);
      }
    } catch (dbErr: any) {
      console.warn('[verifyOtp] Database access error, using resilient session fallback:', dbErr?.message);
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

    // Try to get fresh user profile from DB
    let user: any = null;
    try {
      user = await safeDbQuery(() =>
        prisma.user.findUnique({
          where: { id: payload.sub },
          include: { profile: true, role: true },
        })
      );
    } catch {
      // Ignore DB errors
    }

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
