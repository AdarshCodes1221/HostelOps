const express = require('express');
const router = express.Router();
const {
  getWardenHostel,
  getHostelStudents,
  getPendingHostelStudents,
  approveAndAllocateHostelStudent,
  rejectHostelStudent,
  getHostelComplaints,
  updateHostelComplaint,
  getHostelOutpasses,
  getHostelDashboardStats
} = require('../controllers/wardenController');
const { protect, authorize, hostelScope } = require('../middleware/auth');

// All warden routes require authentication
router.use(protect);

// Apply hostel scoping to all warden routes
router.use(hostelScope());

// Routes accessible by Warden only
router.get('/hostel', authorize('warden'), getWardenHostel);
router.get('/students', authorize('warden'), getHostelStudents);
router.get('/pending-students', authorize('warden'), getPendingHostelStudents);
router.post('/students/:id/approve-and-allocate', authorize('warden'), approveAndAllocateHostelStudent);
router.post('/students/:id/reject', authorize('warden'), rejectHostelStudent);
router.get('/complaints', authorize('warden'), getHostelComplaints);
router.patch('/complaints/:id', authorize('warden'), updateHostelComplaint);
router.get('/outpasses', authorize('warden'), getHostelOutpasses);
router.get('/dashboard', authorize('warden'), getHostelDashboardStats);

module.exports = router;