// scripts/install.js
// Path-resilient dependency installer for Affy FoodBank on Vercel and local dev
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('[install] Starting installation...');
console.log('[install] Current working directory:', process.cwd());
console.log('[install] Script directory:', __dirname);

// Locate the true repository root (where backend/ and frontend/ coexist)
function findRepoRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../..'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'backend')) && fs.existsSync(path.join(c, 'frontend'))) {
      return c;
    }
  }
  return path.resolve(__dirname, '..');
}

const repoRoot = findRepoRoot();
console.log('[install] Resolved repository root:', repoRoot);

const backendDir = path.join(repoRoot, 'backend');
const schemaCandidates = [
  path.join(repoRoot, 'prisma/schema.prisma'),
  path.join(backendDir, 'prisma/schema.prisma'),
];
const schemaPath = schemaCandidates.find(fs.existsSync);

// 1. Install root dependencies
console.log('[install] Installing root dependencies in', repoRoot);
execSync(`${npmCmd} install`, { stdio: 'inherit', cwd: repoRoot, env: process.env });

// 2. Install backend dependencies
if (fs.existsSync(backendDir)) {
  console.log('[install] Installing backend dependencies in', backendDir);
  execSync(`${npmCmd} install`, { stdio: 'inherit', cwd: backendDir, env: process.env });
} else {
  console.warn('[install] Warning: backend directory not found at', backendDir);
}

// 3. Generate Prisma client
if (schemaPath) {
  console.log(`[install] Generating Prisma client from ${schemaPath}...`);
  try {
    execSync(`${npxCmd} prisma generate --schema="${schemaPath}"`, {
      stdio: 'inherit',
      cwd: repoRoot,
      env: process.env,
    });
    console.log('[install] Root Prisma client generated.');
  } catch (err) {
    console.warn('[install] Warning: root prisma generate failed:', err.message);
  }

  if (fs.existsSync(backendDir)) {
    try {
      execSync(`${npxCmd} prisma generate --schema="${schemaPath}"`, {
        stdio: 'inherit',
        cwd: backendDir,
        env: process.env,
      });
      console.log('[install] Backend Prisma client generated.');
    } catch (err) {
      console.warn('[install] Note on backend prisma generate:', err.message);
    }
  }
} else {
  console.warn('[install] Warning: could not locate schema.prisma.');
}

console.log('[install] ✅ Installation completed successfully.');
