const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { createSecureUploader, verifyUploadedFileSignature } = require('../middleware/fileUpload');
const {
  getAllRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  uploadRouteImage,
  getRouteImage,
} = require('../controllers/busRouteController');

const secureBusUpload = createSecureUploader('bus-routes');

// Public routes
router.get('/', getAllRoutes);
router.get('/image', getRouteImage);

// Admin & Warden routes
router.post(
  '/upload-image',
  protect,
  authorize('admin', 'warden'),
  secureBusUpload.single('image'),
  verifyUploadedFileSignature,
  uploadRouteImage
);
router.post('/', protect, authorize('admin', 'warden'), createRoute);
router.put('/:id', protect, authorize('admin', 'warden'), updateRoute);
router.delete('/:id', protect, authorize('admin'), deleteRoute);

module.exports = router;
