// backend/src/middleware/authorize.ts
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Helper to determine if a permission is granted by the given set of permissions and role.
 */
function checkSinglePermission(userPermissions: Set<string>, required: string, role?: string | null): boolean {
  // Admin and SuperAdmin roles bypass all authorization checks
  if (role === 'Admin' || role === 'SuperAdmin') {
    return true;
  }

  // Full wildcard
  if (userPermissions.has('*:*') || userPermissions.has('*')) {
    return true;
  }

  // Exact match
  if (userPermissions.has(required)) {
    return true;
  }

  // Domain or action wildcards (e.g. 'product:*' grants 'product:read')
  const [resource, action] = required.split(':');
  if (resource && userPermissions.has(`${resource}:*`)) {
    return true;
  }
  if (action && userPermissions.has(`*:${action}`)) {
    return true;
  }

  return false;
}

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

    const requiredList = Array.isArray(required) ? required : [required];
    const userPermissions = new Set(req.user.permissions ?? []);

    const hasAll = requiredList.every((perm) =>
      checkSinglePermission(userPermissions, perm, req.user?.role)
    );

    if (!hasAll) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};
