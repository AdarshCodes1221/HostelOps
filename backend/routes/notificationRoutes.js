const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getMyNotifications,
  getUnreadCount,
  createNotification,
  bulkCreateNotifications,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');

// All notification routes require authentication
router.use(protect);

// Retrieve notifications and unread counts
router.get('/', getMyNotifications);
router.get('/my', getMyNotifications);
router.get('/unread-count', getUnreadCount);

// Mark read actions
router.put('/mark-all-read', markAllAsRead);
router.put('/:id/read', markAsRead);

// Admin-only creation endpoints
router.post('/', authorize('admin', 'warden'), createNotification);
router.post('/bulk', authorize('admin', 'warden'), bulkCreateNotifications);

module.exports = router;
