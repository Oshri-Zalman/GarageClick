'use strict';

const { verifyToken } = require('../utils/jwt');

/**
 * authenticate — verifies the Bearer JWT and attaches the decoded payload
 * to req.user ({ user_id, role }). Responds 401 if missing/invalid.
 *
 * Note: this is stateless — it does NOT hit the DB. The token itself is the
 * proof of identity, which satisfies the < 2s real-time requirement (NFR-1).
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  try {
    const payload = verifyToken(token);
    req.user = { user_id: payload.user_id, role: payload.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * authorize(allowedRoles) — guards a route by role. Must run AFTER
 * authenticate so req.user is populated. Responds 403 if the role is not
 * permitted. (TDD §8.1)
 *
 * @param {string[]} allowedRoles  e.g. ['Manager', 'Secretary']
 */
function authorize(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role.' });
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
