'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

/**
 * Creates the target database (if missing) and applies the table DDL.
 *
 * Shared by:
 *   - src/db/init.js        -> production/dev database (npm run db:init)
 *   - tests/globalSetup.js  -> isolated test database (garageclick_test)
 *
 * @param {string} dbName  Database to create/populate.
 */
async function ensureSchema(dbName) {
  const tablesSql = fs.readFileSync(
    path.join(__dirname, 'tables.sql'),
    'utf8'
  );

  // Connect WITHOUT selecting a database so we can create it first.
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` ` +
        'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    await conn.changeUser({ database: dbName });
    await conn.query(tablesSql);
  } finally {
    await conn.end();
  }
}

module.exports = { ensureSchema };
