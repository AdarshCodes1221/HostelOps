const express = require('express');
const router = express.Router();
const {
  verifyOutpassQR,
  checkoutOutpass,
  returnOutpass,
  getGateAttendance
} = require('../controllers/securityController');
const { protect, authorize } = require('../middleware/auth');

// Public / Security Gate verification route
router.post('/verify-qr', protect, authorize('security'), verifyOutpassQR);

// Security-only gate operations
router.post('/checkout', protect, authorize('security'), checkoutOutpass);
router.post('/return', protect, authorize('security'), returnOutpass);
router.get('/attendance', protect, authorize('security', 'admin', 'super_admin', 'warden'), getGateAttendance);

module.exports = router;