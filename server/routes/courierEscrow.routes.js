const express = require('express');
const router = express.Router();
const courierEscrowController = require('../controllers/courierEscrow.controller');

// Public webhook endpoint for Pathao Sandbox
router.post('/pathao-webhook', courierEscrowController.pathaoWebhook);

module.exports = router;
