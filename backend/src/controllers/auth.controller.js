'use strict';

const { pool } = require('../config/db');
const { comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');

/**
 * Auth controller (TDD §4.1).
 */

// POST /api/auth/login
// Body: { username, password }
// Returns: { token, user_id, role, full_name }
async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: '"username" and "password" are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, password_hash, role, full_name, is_active ' +
        'FROM users WHERE username = ?',
      [username]
    );

    const user = rows[0];

    // Use the same 401 for "no such user" and "wrong password" so we don't
    // leak which usernames exist.
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = signToken({ user_id: user.id, role: user.role });

    return res.status(200).json({
      token,
      user_id: user.id,
      role: user.role,
      full_name: user.full_name,
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/auth/verify-token
// Requires the authenticate middleware (so req.user is set).
// Returns: { valid: true, user_id, role }
async function verifyTokenHandler(req, res) {
  return res.status(200).json({
    valid: true,
    user_id: req.user.user_id,
    role: req.user.role,
  });
}

module.exports = { login, verifyTokenHandler };
