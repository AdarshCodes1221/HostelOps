const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  getAvailableRooms,
} = require('../controllers/roomController');
const { protect, optionalAuth, authorize } = require('../middleware/auth');

// Public routes with optional auth (to customize view if admin/warden is signed in)
router.get('/', optionalAuth, getRooms);
router.get('/available', optionalAuth, getAvailableRooms);
router.get('/:id', optionalAuth, getRoom);

// Protected routes (admin only)
router.post('/', protect, authorize('admin'), createRoom);
router.put('/:id', protect, authorize('admin'), updateRoom);
router.delete('/:id', protect, authorize('admin'), deleteRoom);

module.exports = router;