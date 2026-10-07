import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { UnauthorizedError } from '../utils/errors';

/**
 * GET /me – returns basic profile of the authenticated user.
 * Includes role name and permissions for the frontend to drive UI.
 */
export async function getCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError('No authenticated user');

    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        profile: { select: { id: true, phone: true, avatarUrl: true } },
      },
    });

    if (!user) throw new UnauthorizedError('User not found');

    const permissions = (user.role?.rolePermissions ?? []).map(
      (rp) => `${rp.permission.action}:${rp.permission.resource}`,
    );

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role?.name ?? null,
      permissions,
      profile: user.profile ?? null,
    });
  } catch (err) {
    next(err);
  }
}
