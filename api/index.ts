// api/index.ts - Vercel Serverless Function Entry Point
// ALL env mutations must happen before any imports that touch process.env

// Step 1: Set DATABASE_URL from any available Vercel/Supabase env var
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
}

// Step 2: Set JWT_SECRET fallback
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET =
    process.env.SUPABASE_JWT_SECRET ||
    'affy-foodbank-default-jwt-secret-change-in-production';
}

// Step 3: Ensure verified Resend production sender domain (never onboarding@resend.dev in prod)
if (!process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL.includes('onboarding@resend.dev')) {
  process.env.RESEND_FROM_EMAIL = 'Affy FoodBank <noreply@affyfoodbank.com.ng>';
}

// Step 4: Now import the app (after env is ready)
import 'express-async-errors';
import app from '../backend/src/app';

export default app;
