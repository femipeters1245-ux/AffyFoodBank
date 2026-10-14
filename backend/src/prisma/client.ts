// backend/src/prisma/client.ts
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function getDbUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING
  );
}

function createPrismaClient(): PrismaClient {
  const dbUrl = getDbUrl();

  if (!process.env.DATABASE_URL && dbUrl) {
    process.env.DATABASE_URL = dbUrl;
  }

  return new PrismaClient({
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

// Lazy singleton — only instantiated on first use, not at module load time
let _prisma: PrismaClient | undefined;

const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!_prisma) {
      _prisma = global.__prisma ?? createPrismaClient();
      if (process.env.NODE_ENV !== 'production') {
        global.__prisma = _prisma;
      }
    }
    const val = (_prisma as any)[prop];
    return typeof val === 'function' ? val.bind(_prisma) : val;
  },
});

export default prismaProxy;
