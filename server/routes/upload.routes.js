const express = require('express');
const upload = require('../middleware/upload.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Image upload (existing)
router.post('/', protect, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
  }
  res.json({
    status: 'success',
    data: { url: req.file.path },
  });
});

// Video upload for dispute unboxing evidence (max 100MB)
router.post('/video', protect, upload.uploadVideo.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'fail', message: 'No video file uploaded' });
  }
  res.json({
    status: 'success',
    data: { url: req.file.path },
  });
});

module.exports = router;
