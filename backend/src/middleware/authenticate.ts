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
  permissions: string[]; // e.g. ['product:read', 'wallet:deposit']
  profileId: string | null; // CustomerProfile ID
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
 * authenticate – verifies the Bearer JWT and attaches `req.user`.
 * Throws UnauthorizedError for missing / invalid / expired tokens.
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No token provided'));
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new Error('JWT_SECRET is not configured'));
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'));
    }
    return next(new UnauthorizedError('Invalid token'));
  }
};
