const express = require('express');
const router = express.Router();
const {
  createOutpass,
  getMyOutpasses,
  getOutpassById,
  getOutpassStats,
  getAllOutpasses,
  approveOutpass,
  rejectOutpass,
  verifyOutpassQR,
} = require('../controllers/outpassController');
const { protect, authorize } = require('../middleware/auth');

const {
  checkoutOutpass,
  returnOutpass,
} = require('../controllers/securityController');

// Public: Anyone (students/staff/visitors) can verify a pass code for display
router.post('/verify-public', verifyOutpassQR);
router.get('/verify-public', verifyOutpassQR);
router.post('/verify-qr', verifyOutpassQR);
router.get('/verify-qr', verifyOutpassQR);
router.get('/verify', verifyOutpassQR);

// Security Gate Operations: check-out (exit) and return (entry)
router.post('/checkout', protect, authorize('security'), checkoutOutpass);
router.post('/return', protect, authorize('security'), returnOutpass);

// Student: create and view own outpasses
router.post('/', protect, authorize('student'), createOutpass);
router.get('/my', protect, authorize('student'), getMyOutpasses);

// Admin & Warden & Super Admin: analytics and approval/rejection
router.get('/admin/stats', protect, authorize('admin', 'warden', 'super_admin'), getOutpassStats);
router.get('/admin/all', protect, authorize('admin', 'warden', 'super_admin'), getAllOutpasses);
router.put('/admin/:id/approve', protect, authorize('admin', 'warden', 'super_admin'), approveOutpass);
router.put('/admin/:id/reject', protect, authorize('admin', 'warden', 'super_admin'), rejectOutpass);

// Single outpass lookup (IDOR protected — controller enforces ownership)
router.get('/:id', protect, getOutpassById);

module.exports = router;
