'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Shared MySQL connection pool.
 *
 * A pool (instead of a single connection) lets the app reuse a fixed set of
 * connections across concurrent requests, which is what the SRS capacity
 * requirement (NFR-6: ~10 simultaneous users) needs.
 *
 * All queries use parameterized statements (`?` placeholders) — never string
 * concatenation — to prevent SQL injection (TDD §8.3).
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'garageclick',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  namedPlaceholders: false,
});

/**
 * Verify the database is reachable. Called once on server startup so we fail
 * fast with a clear message instead of erroring on the first request.
 */
async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

module.exports = { pool, testConnection };
