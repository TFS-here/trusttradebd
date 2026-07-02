const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/dispute.controller');
const { protect } = require('../middleware/auth.middleware');
const { roleGuard } = require('../middleware/role.middleware');

router.use(protect);

// Buyer — submit a new dispute with unboxing video proof
router.post('/', roleGuard('buyer'), disputeController.submitDispute);

// Admin — list all disputes
router.get('/', roleGuard('admin'), disputeController.getAllDisputes);

// Admin — resolve in buyer's favor (refund)
router.post(
  '/:disputeId/resolve-buyer-favor',
  roleGuard('admin'),
  disputeController.resolveDisputeInBuyerFavor
);

// Admin — resolve in seller's favor (release funds)
router.post(
  '/:disputeId/resolve-seller-favor',
  roleGuard('admin'),
  disputeController.resolveDisputeInSellerFavor
);

module.exports = router;
