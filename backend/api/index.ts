// backend/api/index.ts
// Entry point for Vercel Serverless Function if Root Directory is set to backend
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

import app from '../src/app';

export default app;
