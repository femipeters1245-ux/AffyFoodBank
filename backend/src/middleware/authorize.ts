// backend/src/middleware/authorize.ts
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * authorize – factory that returns a middleware checking whether
 * `req.user` has the given permission string(s).
 *
 * Usage:
 *   router.get('/', authenticate, authorize('product:read'), handler);
 *   router.post('/', authenticate, authorize(['product:create', 'product:update']), handler);
 */
export const authorize = (required: string | string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }

    const requiredSet = Array.isArray(required) ? required : [required];
    const userPermissions = new Set(req.user.permissions ?? []);

    const hasAll = requiredSet.every((perm) => userPermissions.has(perm));
    if (!hasAll) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};
