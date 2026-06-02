'use strict';

/**
 * Applies schema.sql to the configured MySQL server.
 *
 * Usage:  npm run db:init
 *
 * Connects WITHOUT a default database (the script itself runs
 * CREATE DATABASE ... / USE ...) and with multipleStatements enabled so the
 * whole file runs in one shot. This is a setup utility — the app at runtime
 * uses the pooled, single-statement connection in config/db.js.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    console.log('Applying schema.sql ...');
    await conn.query(sql);
    console.log('✓ Schema applied successfully.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('✗ Schema init failed:', err.message);
  process.exit(1);
});
