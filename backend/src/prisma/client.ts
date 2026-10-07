// backend/src/prisma/client.ts
import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client.
 * In development, ts-node-dev reloads modules on change which can create
 * multiple PrismaClient instances and exhaust the DB connection pool.
 * We cache the instance on the global object to prevent this.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export default prisma;
