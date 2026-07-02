const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.post('/', chatController.sendMessage);
router.get('/:orderId', chatController.getMessages);

module.exports = router;
