const express = require('express');
const {
  getProductQuestions,
  askQuestion,
  answerQuestion,
  deleteQuestion,
  getSellerPendingQuestions,
} = require('../controllers/qa.controller');
const { protect } = require('../middleware/auth.middleware');
const { roleGuard } = require('../middleware/role.middleware');

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────
router.get('/product/:productId', getProductQuestions);

// ── Authenticated ─────────────────────────────────────────────────
router.use(protect);

router.post('/product/:productId',        askQuestion);
router.put('/:id/answer',                 roleGuard('seller'), answerQuestion);
router.delete('/:id',                     deleteQuestion);
router.get('/seller/pending',             roleGuard('seller'), getSellerPendingQuestions);

module.exports = router;
