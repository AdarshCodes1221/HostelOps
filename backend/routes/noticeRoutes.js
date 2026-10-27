const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { createSecureUploader, verifyUploadedFileSignature } = require('../middleware/fileUpload');
const {
  getAllNotices,
  createNotice,
  deleteNotice,
} = require('../controllers/noticeController');

const secureNoticeUpload = createSecureUploader('notices');

// Routes
router.get('/', protect, getAllNotices);
router.post(
  '/',
  protect,
  authorize('admin', 'warden'),
  secureNoticeUpload.single('image'),
  verifyUploadedFileSignature,
  createNotice
);
router.delete('/:id', protect, authorize('admin'), deleteNotice);

module.exports = router;
