'use strict';

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const customersRoutes = require('./routes/customers.routes');
const vehiclesRoutes = require('./routes/vehicles.routes');

/**
 * Builds and configures the Express application.
 * Kept separate from server.js so it can be imported in tests later
 * without binding to a port.
 */
function createApp() {
  const app = express();

  // ----- Global middleware -----
  app.use(cors());
  app.use(express.json());

  // ----- Health check -----
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'garageclick-backend' });
  });

  // ----- Feature routes -----
  app.use('/api/auth', authRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/vehicles', vehiclesRoutes);

  // ----- 404 fallback -----
  app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // ----- Centralized error handler -----
  // Controllers forward errors here via next(err), so they don't each
  // repeat try/catch response logic.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

module.exports = { createApp };
