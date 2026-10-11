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

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!process.env.DATABASE_URL && dbUrl) {
  process.env.DATABASE_URL = dbUrl;
}

const prisma =
  global.__prisma ??
  new PrismaClient({
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export default prisma;
