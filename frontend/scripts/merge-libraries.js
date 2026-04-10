#!/usr/bin/env node
/**
 * merge-libraries.js
 *
 * Reads every .excalidrawlib file from the source folder, extracts their
 * libraryItems arrays, and writes a single JSON bundle to public/libraries/.
 *
 * Usage:
 *   node scripts/merge-libraries.js [sourceDir]
 *
 * If sourceDir is omitted it defaults to public/libraries/individual/
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR =
  process.argv[2] ||
  path.join(__dirname, '..', 'public', 'libraries', 'individual');
const OUT_FILE = path.join(
  __dirname,
  '..',
  'public',
  'libraries',
  'bundled-libraries.json',
);

function run() {
  if (!fs.existsSync(SRC_DIR)) {
    if (fs.existsSync(OUT_FILE)) {
      console.log('⏭ Source directory not found, but bundled-libraries.json already exists — skipping merge.');
      process.exit(0);
    }
    console.error(`Source directory not found: ${SRC_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.excalidrawlib'));

  if (files.length === 0) {
    console.warn('No .excalidrawlib files found in', SRC_DIR);
    process.exit(0);
  }

  const allItems = [];
  let failed = 0;

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
      const data = JSON.parse(raw);
      const items = data.libraryItems || [];
      items.forEach((item) => {
        item.status = 'published';
        allItems.push(item);
      });
    } catch (err) {
      console.warn(`  ⚠ Skipped ${file}: ${err.message}`);
      failed++;
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(allItems));

  const sizeMB = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
  console.log(
    `✔ Merged ${files.length - failed} libraries → ${allItems.length} items (${sizeMB} MB)`,
  );
  console.log(`  Output: ${OUT_FILE}`);
}

run();
