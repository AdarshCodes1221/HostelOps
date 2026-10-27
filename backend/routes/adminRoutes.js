const express = require('express');
const router = express.Router();
const {
  getUsers,
  getDashboardStats,
  getRoomsByHostel,
  addRoomOccupant,
  removeRoomOccupant,
  updateUserRole,
  deleteUser,
  searchStudentByPRN,
  approveRoomChange,
  rejectRoomChange,
  adminLogin,
  adminLogout,
  adminForgotPassword,
  adminResetPassword,
  getPendingStudents,
  approveAndAllocateStudent,
  rejectStudent,
  reassignStudentRoom,
} = require('../controllers/adminController');
const {
  confirmBooking,
  cancelBookingAdmin,
} = require('../controllers/bookingController');
const {
  getAllComplaints,
  updateComplaint,
  deleteComplaint,
} = require('../controllers/complaintController');
const { protect, authorize, preventGateOperations } = require('../middleware/auth');

// Public Admin Authentication Routes (Dedicated admin portal auth)
router.post('/login', adminLogin);
router.post('/logout', adminLogout);
router.post('/forgot-password', adminForgotPassword);
router.post('/reset-password/:token', adminResetPassword);
router.post('/reset-password', adminResetPassword);

// All downstream administrative routes require authentication
router.use(protect);

// Prevent admins from performing gate operations
router.use(preventGateOperations());

// Routes accessible by both Admin and Warden
router.get('/dashboard', authorize('admin', 'warden'), getDashboardStats);
router.get('/rooms', authorize('admin', 'warden'), getRoomsByHostel);
router.get('/students/:prn', authorize('admin', 'warden'), searchStudentByPRN);
router.get('/complaints', authorize('admin', 'warden'), getAllComplaints);
router.patch('/complaints/:id', authorize('admin', 'warden'), updateComplaint);
router.get('/pending-students', authorize('admin', 'warden'), getPendingStudents);
router.post('/students/:id/approve-and-allocate', authorize('admin', 'warden'), approveAndAllocateStudent);
router.post('/students/:id/reject', authorize('admin', 'warden'), rejectStudent);
router.put('/students/:id/reassign-room', authorize('admin', 'warden'), reassignStudentRoom);
router.put('/students/:id/approve-room-change', authorize('admin', 'warden'), approveRoomChange);
router.put('/students/:id/reject-room-change', authorize('admin', 'warden'), rejectRoomChange);

// Routes restricted strictly to Admin & Super Admin
router.get('/users', authorize('super_admin', 'admin'), getUsers);
router.put('/users/:id/role', authorize('super_admin', 'admin'), updateUserRole);
router.delete('/users/:id', authorize('super_admin', 'admin'), deleteUser);
router.post('/rooms/:roomId/occupants', authorize('super_admin', 'admin'), addRoomOccupant);
router.delete('/rooms/:roomId/occupants/:userId', authorize('super_admin', 'admin'), removeRoomOccupant);
router.delete('/complaints/:id', authorize('super_admin', 'admin'), deleteComplaint);
router.put('/bookings/:id/confirm', authorize('super_admin', 'admin'), confirmBooking);
router.put('/bookings/:id/cancel', authorize('super_admin', 'admin'), cancelBookingAdmin);

module.exports = router;