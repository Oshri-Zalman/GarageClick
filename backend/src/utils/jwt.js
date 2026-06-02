'use strict';

const jwt = require('jsonwebtoken');

/**
 * JWT helpers. The signed payload carries the user's id and role so that
 * the authorize() middleware can make permission decisions without an extra
 * DB round-trip on every request.
 */

function getSecret() {
  // Read lazily (not at module load) so tests can set the env first.
  return process.env.JWT_SECRET || 'dev_insecure_secret_change_me';
}

function signToken({ user_id, role }) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  return jwt.sign({ user_id, role }, getSecret(), { expiresIn });
}

function verifyToken(token) {
  // Throws if invalid/expired; callers handle the error.
  return jwt.verify(token, getSecret());
}

module.exports = { signToken, verifyToken };
