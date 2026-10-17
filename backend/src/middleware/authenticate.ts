// backend/src/middleware/authenticate.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors';

/**
 * Shape of the JWT payload we sign on login.
 * Attach to req.user so downstream handlers can access it.
 */
export interface JwtPayload {
  sub: string;          // user ID (UUID)
  email: string;
  roleId: string | null;
  role?: string | null;
  permissions: string[]; // e.g. ['product:read', 'wallet:deposit']
  profileId: string | null; // CustomerProfile ID
  iat?: number;
  exp?: number;
}

// Extend Express's Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Extract token from HttpOnly cookies (affy_session, token) or Bearer header
 */
export function extractTokenFromRequest(req: Request): string | null {
  // 1. Check parsed cookies
  if (req.cookies?.affy_session) {
    return req.cookies.affy_session;
  }
  if (req.cookies?.token) {
    return req.cookies.token;
  }

  // 2. Fallback cookie header parse (if cookie-parser was bypassed)
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const sessionMatch = cookieHeader.match(/(^|;\s*)affy_session=([^;]*)/);
    if (sessionMatch) return decodeURIComponent(sessionMatch[2]);

    const tokenMatch = cookieHeader.match(/(^|;\s*)token=([^;]*)/);
    if (tokenMatch) return decodeURIComponent(tokenMatch[2]);
  }

  // 3. Check Authorization header Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * authenticate – verifies HttpOnly session cookie or Bearer JWT and attaches `req.user`.
 * Throws UnauthorizedError for missing / invalid / expired tokens.
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const token = extractTokenFromRequest(req);
  if (!token) {
    return next(new UnauthorizedError('Authentication session required. Please sign in.'));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(
      new Error(
        'Server configuration error: JWT_SECRET environment variable is not set.'
      )
    );
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Session has expired. Please sign in again.'));
    }
    return next(new UnauthorizedError('Invalid authentication token'));
  }
};
