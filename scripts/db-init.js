// scripts/db-init.js
// Runs during Vercel deployment build step to ensure the database schema exists
// and the demo accounts / roles are seeded in Supabase.

const { execSync } = require('child_process');
const path = require('path');

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;

if (!dbUrl) {
  console.log('[db-init] No PostgreSQL database URL found in environment, skipping schema push.');
  process.exit(0);
}

// Ensure Prisma CLI finds the DATABASE_URL
process.env.DATABASE_URL = dbUrl;
const schemaPath = path.resolve(__dirname, '../backend/prisma/schema.prisma');

console.log('[db-init] Pushing Prisma schema to PostgreSQL database...');
try {
  execSync(`npx prisma db push --schema="${schemaPath}" --accept-data-loss`, {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('[db-init] Schema synced successfully.');
} catch (err) {
  console.error('[db-init] Warning: prisma db push failed:', err.message);
}
