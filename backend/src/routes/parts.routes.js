'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/parts.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const ALL_ROLES = ['Manager', 'Secretary', 'Mechanic'];
const STAFF = ['Manager', 'Secretary'];

// Compatibility lookup is used by anyone opening a ticket (incl. Mechanic).
// Registered before any potential param routes.
router.get('/compatible', authorize(ALL_ROLES), ctrl.getCompatible);

// Inventory management is staff-only (Manager/Secretary) — Mechanic can't see
// or edit full stock (SRS matrix, FR-7).
router.get('/inventory', authorize(STAFF), ctrl.listInventory);
router.post('/', authorize(STAFF), ctrl.createPart);
router.put('/:id', authorize(STAFF), ctrl.updatePart);

module.exports = router;
