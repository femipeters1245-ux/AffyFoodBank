// scripts/build.js
// Vercel buildCommand: node scripts/build.js
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('[build] Starting build process...');
console.log('[build] Current working directory:', process.cwd());
console.log('[build] Script directory:', __dirname);

// ── 1. Prisma generate (needed by the api/ serverless function) ────────────────
const repoRoot = path.resolve(__dirname, '..');
const schemaCandidates = [
  path.resolve(repoRoot, 'prisma/schema.prisma'),
  path.resolve(repoRoot, 'backend/prisma/schema.prisma'),
  path.resolve(process.cwd(), 'prisma/schema.prisma'),
];
const schemaPath = schemaCandidates.find(fs.existsSync);

if (schemaPath) {
  console.log(`[build] Generating Prisma client from ${schemaPath}...`);
  try {
    execSync(`${npxCmd} prisma generate --schema="${schemaPath}"`, {
      stdio: 'inherit',
      cwd: repoRoot,
      env: process.env,
    });
    console.log('[build] Root Prisma client generated.');

    // Also ensure backend has dependencies and generated client
    const backendDir = path.resolve(repoRoot, 'backend');
    if (fs.existsSync(backendDir)) {
      const backendModules = path.join(backendDir, 'node_modules');
      if (!fs.existsSync(backendModules)) {
        console.log('[build] Backend node_modules not found. Installing backend dependencies...');
        execSync(`${npmCmd} install`, {
          stdio: 'inherit',
          cwd: backendDir,
          env: process.env,
        });
        console.log('[build] Backend dependencies installed.');
      }
      try {
        execSync(`${npxCmd} prisma generate --schema="${schemaPath}"`, {
          stdio: 'inherit',
          cwd: backendDir,
          env: process.env,
        });
        console.log('[build] Backend Prisma client generated.');
      } catch (err) {
        console.warn('[build] Note on backend prisma generate:', err.message);
      }
    }
  } catch (err) {
    console.warn('[build] Warning: prisma generate failed (non-fatal):', err.message);
  }
} else {
  console.warn('[build] Warning: could not locate schema.prisma, skipping prisma generate.');
}

// ── 2. Optional DB push (disabled by default to prevent build hangs on Supabase pooler) ──
const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;

if (process.env.RUN_DB_PUSH === 'true' && dbUrl && schemaPath) {
  process.env.DATABASE_URL = dbUrl;
  console.log('[build] Pushing schema to database...');
  try {
    execSync(`${npxCmd} prisma db push --schema="${schemaPath}" --accept-data-loss`, {
      stdio: 'inherit',
      env: process.env,
      timeout: 10000,
    });
    console.log('[build] Schema pushed.');
  } catch (err) {
    console.warn('[build] Warning: prisma db push failed (non-fatal):', err.message);
  }
} else {
  console.log('[build] Skipping db push during web build (schema already initialized).');
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

// Mirror to root dist so Vercel finds output regardless of configured outputDirectory
const rootDist = path.resolve(process.cwd(), 'dist');
try {
  if (distDir !== rootDist) {
    fs.mkdirSync(rootDist, { recursive: true });
    fs.cpSync(distDir, rootDist, { recursive: true });
    console.log('[build] Copied frontend/dist to root dist.');
  }
} catch (e) {
  console.warn('[build] Note on dist copy:', e.message);
}

console.log('[build] ✅ Build completed successfully.');
