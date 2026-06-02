'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // Runs ONCE before the whole suite: creates the test DB + tables.
  globalSetup: '<rootDir>/tests/globalSetup.js',
  // Runs before each test file's modules load: points the app at the test DB.
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // Integration tests share one test DB, so run serially (also set via --runInBand).
  maxWorkers: 1,
};
