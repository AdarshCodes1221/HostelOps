const express = require('express');
const router = express.Router();
const {
  getHostels,
  getHostel,
  createHostel,
  updateHostel,
  deleteHostel,
  toggleHostelStatus,
  getHostelSummary,
} = require('../controllers/hostelController');
const { protect, authorize } = require('../middleware/auth');
const roomRouter = require('./roomRoutes');

// Re-route into other resource routers
router.use('/:hostelId/rooms', roomRouter);

// Public routes
router.get('/', getHostels);
router.get('/:id', getHostel);

// Protected routes
router.get('/:id/summary', protect, authorize('admin', 'warden'), getHostelSummary);
router.patch('/:id/toggle-status', protect, authorize('admin'), toggleHostelStatus);
router.post('/', protect, authorize('admin'), createHostel);
router.put('/:id', protect, authorize('admin'), updateHostel);
router.delete('/:id', protect, authorize('admin'), deleteHostel);

module.exports = router;