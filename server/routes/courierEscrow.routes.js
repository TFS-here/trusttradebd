const express = require('express');
const router = express.Router();
const courierEscrowController = require('../controllers/courierEscrow.controller');

// Public webhook endpoint for Pathao Sandbox
router.post('/pathao-webhook', courierEscrowController.pathaoWebhook);

// Vercel Cron Endpoint for Auto-releasing funds
router.post('/cron/auto-release', courierEscrowController.autoReleaseEscrowCronEndpoint);

module.exports = router;
