'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Public: exchange credentials for a JWT.
router.post('/login', ctrl.login);

// Protected: confirm a token is still valid and echo identity.
router.get('/verify-token', authenticate, ctrl.verifyTokenHandler);

module.exports = router;
