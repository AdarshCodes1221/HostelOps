const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { createSecureUploader, verifyUploadedFileSignature } = require('../middleware/fileUpload');
const {
  getAllMenus,
  getLatestMenu,
  createMenu,
  updateMenu,
  batchCreateMenus,
  uploadMenuImage,
} = require('../controllers/messMenuController');

const secureMessUpload = createSecureUploader('mess-menu');

// Public routes
router.get('/', getAllMenus);
router.get('/latest', getLatestMenu);

// Admin & Warden routes - protected
router.post(
  '/upload-image',
  protect,
  authorize('admin', 'warden'),
  secureMessUpload.single('image'),
  verifyUploadedFileSignature,
  uploadMenuImage
);
router.post('/batch', protect, authorize('admin', 'warden'), batchCreateMenus);
router.post('/', protect, authorize('admin', 'warden'), createMenu);
router.put('/:id', protect, authorize('admin', 'warden'), updateMenu);

module.exports = router;
