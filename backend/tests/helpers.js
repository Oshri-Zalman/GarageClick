'use strict';

const { pool } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');
const { signToken } = require('../src/utils/jwt');

/**
 * Wipe all data tables for a clean slate between tests.
 * DELETE (not TRUNCATE) is used because MySQL forbids TRUNCATE on a table
 * referenced by a foreign key; with FK checks off, DELETE is order-safe.
 */
async function resetDb() {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query('DELETE FROM vehicles');
  await pool.query('DELETE FROM customers');
  await pool.query('DELETE FROM users');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

/**
 * Insert a user with a hashed password.
 * @returns {Promise<{id:number, username:string, role:string}>}
 */
async function createUser({
  username,
  password = 'secret123',
  role = 'Mechanic',
  full_name = 'Test User',
  is_active = true,
}) {
  const hash = await hashPassword(password);
  const [result] = await pool.query(
    'INSERT INTO users (username, password_hash, role, full_name, is_active) ' +
      'VALUES (?, ?, ?, ?, ?)',
    [username, hash, role, full_name, is_active]
  );
  return { id: result.insertId, username, role };
}

/**
 * Create a customer directly (bypassing the API), for arranging test state.
 */
async function createCustomer({ full_name = 'דן', phone_number = '0501234567' } = {}) {
  const [result] = await pool.query(
    'INSERT INTO customers (full_name, phone_number) VALUES (?, ?)',
    [full_name, phone_number]
  );
  return { id: result.insertId, full_name, phone_number };
}

/** Sign a valid JWT for a given user (no DB lookup needed by middleware). */
function tokenFor(user) {
  return signToken({ user_id: user.id, role: user.role });
}

/** Convenience: Authorization header value. */
function bearer(token) {
  return `Bearer ${token}`;
}

module.exports = {
  pool,
  resetDb,
  createUser,
  createCustomer,
  tokenFor,
  bearer,
};
