// api/index.ts
import 'express-async-errors';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
}

if (!process.env.JWT_SECRET && process.env.SUPABASE_JWT_SECRET) {
  process.env.JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
}

import app from '../backend/src/app';

export default app;
