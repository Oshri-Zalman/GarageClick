'use strict';

require('dotenv').config();
const { createApp } = require('./app');
const { testConnection } = require('./config/db');

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  // Fail fast if the DB is unreachable.
  try {
    await testConnection();
    console.log('✓ Database connection OK.');
  } catch (err) {
    console.error('✗ Cannot connect to the database:', err.message);
    process.exit(1);
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`✓ GarageClick backend listening on http://localhost:${PORT}`);
  });
}

start();
