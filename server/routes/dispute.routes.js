const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/dispute.controller');
const { protect } = require('../middleware/auth.middleware');
const { roleGuard } = require('../middleware/role.middleware');

router.use(protect);

// Admin only route to get all disputes
router.get('/', roleGuard('admin'), disputeController.getAllDisputes);

// Admin only route to resolve a dispute in buyer's favor
router.post(
  '/:disputeId/resolve-buyer-favor',
  roleGuard('admin'),
  disputeController.resolveDisputeInBuyerFavor
);

module.exports = router;
