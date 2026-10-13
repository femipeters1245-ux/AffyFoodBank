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

// 4. Copy dist output if running from backend root
const distSrc = path.join(frontendDir, 'dist');
const distTarget = path.resolve(process.cwd(), 'frontend/dist');
if (distSrc !== distTarget && fs.existsSync(distSrc)) {
  fs.mkdirSync(distTarget, { recursive: true });
  fs.cpSync(distSrc, distTarget, { recursive: true });
}

console.log('[build] Build step completed successfully.');
