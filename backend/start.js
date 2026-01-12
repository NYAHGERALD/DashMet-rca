#!/usr/bin/env node
console.log('=== START SCRIPT RUNNING ===');
console.log('Node version:', process.version);
console.log('Current dir:', process.cwd());
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

try {
  console.log('Loading tsx...');
  require('tsx/cjs');
  console.log('tsx loaded, starting server...');
  require('./src/server.ts');
} catch (error) {
  console.error('=== STARTUP ERROR ===');
  console.error(error);
  process.exit(1);
}
