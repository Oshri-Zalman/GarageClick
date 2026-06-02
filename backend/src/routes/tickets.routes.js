'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tickets.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Every ticket route requires a valid token.
router.use(authenticate);

const ALL_ROLES = ['Manager', 'Secretary', 'Mechanic'];

// Opening a ticket: all roles (Mechanic restricted to self-assignment in the
// controller). Status change: all roles (Mechanic restricted to own tickets
// by the workflow service's authorizeStatusChange).
router.post('/', authorize(ALL_ROLES), ctrl.createTicket);
router.patch('/:id/status', authorize(ALL_ROLES), ctrl.updateTicketStatus);

// Supporting reads (role filtering handled in the controller).
router.get('/', authorize(ALL_ROLES), ctrl.listTickets);
router.get('/:id', authorize(ALL_ROLES), ctrl.getTicketById);

module.exports = router;
