'use strict';

/**
 * Applies the core schema to the configured (production/dev) database.
 *
 * Usage:  npm run db:init
 */
require('dotenv').config();
const { ensureSchema } = require('./migrate');

async function main() {
  const dbName = process.env.DB_NAME || 'garageclick';
  console.log(`Applying schema to "${dbName}" ...`);
  await ensureSchema(dbName);
  console.log('✓ Schema applied successfully.');
}

main().catch((err) => {
  console.error('✗ Schema init failed:', err.message);
  process.exit(1);
});
