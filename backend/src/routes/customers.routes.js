'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customers.controller');

// NOTE: /search must be registered before /:id, otherwise "search"
// would be matched as an :id value.
router.get('/search', ctrl.searchCustomers);
router.get('/', ctrl.listCustomers);
router.get('/:id', ctrl.getCustomerById);
router.post('/', ctrl.createCustomer);
router.put('/:id', ctrl.updateCustomer);

module.exports = router;
