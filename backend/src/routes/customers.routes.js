'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customers.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Every customer route requires a valid token.
router.use(authenticate);

const ALL_ROLES = ['Manager', 'Secretary', 'Mechanic'];
const STAFF = ['Manager', 'Secretary']; // admin-style actions

// NOTE: /search must be registered before /:id, otherwise "search"
// would be matched as an :id value.

// Plate lookup + create are needed by anyone opening a ticket (incl. Mechanic).
router.get('/search', authorize(ALL_ROLES), ctrl.searchCustomers);
router.get('/:id', authorize(ALL_ROLES), ctrl.getCustomerById);
router.post('/', authorize(ALL_ROLES), ctrl.createCustomer);

// Listing everyone and editing a profile are staff-only (Manager/Secretary).
router.get('/', authorize(STAFF), ctrl.listCustomers);
router.put('/:id', authorize(STAFF), ctrl.updateCustomer);

module.exports = router;
