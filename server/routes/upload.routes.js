const express = require('express');
const upload = require('../middleware/upload.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/', protect, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
  }
  res.json({
    status: 'success',
    data: {
      url: req.file.path,
    },
  });
});

module.exports = router;
