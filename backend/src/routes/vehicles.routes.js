'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vehicles.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Every vehicle route requires a valid token.
router.use(authenticate);

const ALL_ROLES = ['Manager', 'Secretary', 'Mechanic'];
const STAFF = ['Manager', 'Secretary'];

// /search before /:id (see customers.routes.js note).

// Plate lookup + create are part of opening a ticket (incl. Mechanic).
router.get('/search', authorize(ALL_ROLES), ctrl.searchVehicleByPlate);
router.get('/:id', authorize(ALL_ROLES), ctrl.getVehicleById);
router.post('/', authorize(ALL_ROLES), ctrl.createVehicle);

// Full listing + edits are staff-only.
router.get('/', authorize(STAFF), ctrl.listVehicles);
router.put('/:id', authorize(STAFF), ctrl.updateVehicle);

module.exports = router;
