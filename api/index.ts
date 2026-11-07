// api/index.ts - Vercel Serverless Function Entry Point
// ALL env mutations must happen before any imports that touch process.env
import path from 'path';
import dotenv from 'dotenv';

// Attempt to load .env from root and backend folder if present
try {
  dotenv.config();
  dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
  dotenv.config({ path: path.resolve(__dirname, '..', 'backend', '.env') });
} catch {
  // Ignore filesystem errors in serverless environments
}

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
    '7H4llDStpfCmtxVBUpCHs8dsynsEgVopYloaECF+Z5yDHbpe7LcwRaR/yIQlrE1e6snoZDiKdkpwclOZufh4yg==';
}

// Step 3: Set Supabase Cloud credentials (single source of truth for products & accounts)
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://jtwrnpqyvypvljgywwau.supabase.co';
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0d3JucHF5dnlwdmxqZ3l3d2F1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTQ5Mjk1OCwiZXhwIjoyMTA3MDY4OTU4fQ.E1rdcNicpDbxVWGSLQnrLeEJFoWy5lE5FWBMEsNwFj0';
}

// Step 4: Ensure verified Resend production configuration
if (!process.env.RESEND_API_KEY && process.env.RESEND_KEY) {
  process.env.RESEND_API_KEY = process.env.RESEND_KEY;
}

if (!process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL.includes('onboarding@resend.dev')) {
  process.env.RESEND_FROM_EMAIL = 'Affy FoodBank <noreply@affyfoodbank.com.ng>';
}

// Step 5: Now import the app (after env is ready)
import 'express-async-errors';
import app from '../backend/src/app';

export default app;
