// scripts/build.js
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('[build] Starting unified build process...');

// 1. Database schema sync
try {
  const dbInit = path.resolve(__dirname, 'db-init.js');
  if (fs.existsSync(dbInit)) {
    console.log('[build] Running db-init...');
    require(dbInit);
  }
} catch (err) {
  console.warn('[build] db-init warning (non-fatal):', err.message);
}

// 2. Locate frontend directory
let frontendDir = path.resolve(__dirname, '../frontend');
if (!fs.existsSync(frontendDir)) {
  frontendDir = path.resolve(__dirname, '../../frontend');
}
if (!fs.existsSync(frontendDir)) {
  frontendDir = path.resolve(process.cwd(), 'frontend');
}

if (!fs.existsSync(frontendDir)) {
  console.error('[build] Fatal: frontend directory not found!');
  process.exit(1);
}

console.log('[build] Building frontend in:', frontendDir);

// 3. Install and build frontend
try {
  execSync(`${npmCmd} install`, {
    stdio: 'inherit',
    cwd: frontendDir,
    env: process.env,
  });
  execSync(`${npmCmd} run build`, {
    stdio: 'inherit',
    cwd: frontendDir,
    env: process.env,
  });
} catch (buildErr) {
  console.error('[build] Frontend build error:', buildErr.message);
  process.exit(1);
}

// 4. Verify dist output
const distSrc = path.join(frontendDir, 'dist');
console.log(`[build] Checking generated dist at: ${distSrc}`);
if (!fs.existsSync(distSrc)) {
  console.error(`[build] Fatal: dist folder was not generated at ${distSrc}`);
  process.exit(1);
}

// 5. Sync dist folder across all workspace locations Vercel might inspect
const targetLocations = [
  path.resolve(process.cwd(), 'dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(frontendDir, '../dist'),
  path.resolve(frontendDir, 'dist'),
];

targetLocations.forEach((targetDir) => {
  try {
    if (path.resolve(distSrc) !== path.resolve(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.cpSync(distSrc, targetDir, { recursive: true });
      console.log(`[build] Successfully copied dist to: ${targetDir}`);
    }
  } catch (copyErr) {
    console.warn(`[build] Note on syncing to ${targetDir}:`, copyErr.message);
  }
});

console.log('[build] Build and distribution sync completed successfully.');
