const express = require('express');
const router = express.Router();
const {
  createComplaint,
  getMyComplaints,
  getComplaintById,
} = require('../controllers/complaintController');
const { protect } = require('../middleware/auth');

// Protected complaint routes
router.post('/', protect, createComplaint);
router.get('/my', protect, getMyComplaints);
router.get('/:id', protect, getComplaintById);

module.exports = router;
