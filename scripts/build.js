// scripts/build.js
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function run(cmd, cwd) {
  console.log(`[build] Executing: ${cmd} in ${cwd || process.cwd()}`);
  execSync(cmd, { stdio: 'inherit', cwd: cwd || process.cwd(), env: process.env });
}

// 1. Run database schema sync
try {
  const dbInit = path.resolve(__dirname, 'db-init.js');
  if (fs.existsSync(dbInit)) {
    require(dbInit);
  }
} catch (err) {
  console.warn('[build] db-init notice:', err.message);
}

// 2. Locate frontend directory
let frontendDir = path.resolve(__dirname, '../frontend');
if (!fs.existsSync(frontendDir)) {
  frontendDir = path.resolve(__dirname, '../../frontend');
}

// 3. Build frontend bundle
console.log('[build] Building frontend in:', frontendDir);
run('npm install', frontendDir);
run('npm run build', frontendDir);

// 4. Ensure dist exists in every possible directory Vercel checks
const distSrc = path.join(frontendDir, 'dist');
if (fs.existsSync(distSrc)) {
  const targetLocations = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(__dirname, '../dist'),
    path.resolve(__dirname, '../../dist'),
    path.resolve(__dirname, '../frontend/dist'),
  ];

  targetLocations.forEach((targetDir) => {
    try {
      if (distSrc !== targetDir) {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.cpSync(distSrc, targetDir, { recursive: true });
        console.log(`[build] Synced build output to: ${targetDir}`);
      }
    } catch (e) {
      // ignore
    }
  });
}

console.log('[build] Build step completed successfully.');
