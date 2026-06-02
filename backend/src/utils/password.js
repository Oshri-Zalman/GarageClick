'use strict';

const bcrypt = require('bcryptjs');

// bcryptjs is a pure-JS implementation (no native build step), which keeps
// setup painless across machines for an academic project.
const SALT_ROUNDS = 10;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, comparePassword };
