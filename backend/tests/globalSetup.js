'use strict';

// Runs ONCE before the entire test suite (separate process from the tests).
// Ensures the isolated test database and its tables exist.
require('dotenv').config();
const { ensureSchema } = require('../src/db/migrate');

module.exports = async function globalSetup() {
  const testDb = process.env.DB_NAME_TEST || 'garageclick_test';
  try {
    await ensureSchema(testDb);
  } catch (err) {
    throw new Error(
      `Could not prepare test database "${testDb}". Is MySQL running and are ` +
        `DB_* env vars correct? Original error: ${err.message}`
    );
  }
};
