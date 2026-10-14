// backend/api/index.ts
// Entry point for Vercel Serverless Function if Root Directory is set to backend
import 'express-async-errors';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'affy-foodbank-super-secret-jwt-key-2024';
}

import app from '../src/app';

export default async function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[API Serverless Error]:', err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred in the API handler.',
    });
  }
}
