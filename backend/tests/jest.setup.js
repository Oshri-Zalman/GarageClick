'use strict';

// Runs before any application module is required in a test file.
// Load real env, then force the app to use the ISOLATED test database so we
// never touch development/production data. dotenv does not override variables
// that are already set, so assigning DB_NAME here takes precedence.
require('dotenv').config();

process.env.DB_NAME = process.env.DB_NAME_TEST || 'garageclick_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
