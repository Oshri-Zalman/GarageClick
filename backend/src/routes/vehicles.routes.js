'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vehicles.controller');

// /search before /:id (see customers.routes.js note).
router.get('/search', ctrl.searchVehicleByPlate);
router.get('/', ctrl.listVehicles);
router.get('/:id', ctrl.getVehicleById);
router.post('/', ctrl.createVehicle);
router.put('/:id', ctrl.updateVehicle);

module.exports = router;
