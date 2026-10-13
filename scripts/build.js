// scripts/build.js
// Vercel buildCommand: node scripts/build.js
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('[build] Starting build process...');

// ── 1. Prisma generate (needed by the api/ serverless function) ────────────────
// Resolve schema path: prefer root prisma/, fall back to backend/prisma/
const schemaCandidates = [
  path.resolve(__dirname, '../prisma/schema.prisma'),
  path.resolve(__dirname, '../backend/prisma/schema.prisma'),
  path.resolve(process.cwd(), 'prisma/schema.prisma'),
];
const schemaPath = schemaCandidates.find(fs.existsSync);

if (schemaPath) {
  console.log(`[build] Generating Prisma client from ${schemaPath}...`);
  try {
    execSync(`${npxCmd} prisma generate --schema="${schemaPath}"`, {
      stdio: 'inherit',
      env: process.env,
    });
    console.log('[build] Prisma client generated.');
  } catch (err) {
    console.warn('[build] Warning: prisma generate failed (non-fatal):', err.message);
  }
} else {
  console.warn('[build] Warning: could not locate schema.prisma, skipping prisma generate.');
}

// ── 2. Optional DB push (only when DATABASE_URL is available) ─────────────────
const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;

if (dbUrl && schemaPath) {
  process.env.DATABASE_URL = dbUrl;
  console.log('[build] Pushing schema to database...');
  try {
    execSync(`${npxCmd} prisma db push --schema="${schemaPath}" --accept-data-loss`, {
      stdio: 'inherit',
      env: process.env,
    });
    console.log('[build] Schema pushed.');
  } catch (err) {
    console.warn('[build] Warning: prisma db push failed (non-fatal):', err.message);
  }
} else {
  console.log('[build] No DATABASE_URL found – skipping db push.');
}

// ── 3. Build frontend ─────────────────────────────────────────────────────────
const frontendDir = path.resolve(__dirname, '../frontend');
if (!fs.existsSync(frontendDir)) {
  console.error('[build] Fatal: frontend directory not found at', frontendDir);
  process.exit(1);
}

console.log('[build] Installing frontend dependencies...');
execSync(`${npmCmd} install`, { stdio: 'inherit', cwd: frontendDir, env: process.env });

console.log('[build] Building frontend...');
execSync(`${npmCmd} run build`, { stdio: 'inherit', cwd: frontendDir, env: process.env });

// Verify output
const distDir = path.join(frontendDir, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('[build] Fatal: frontend/dist was not generated!');
  process.exit(1);
}

console.log('[build] ✅ Build completed. Output in frontend/dist');
