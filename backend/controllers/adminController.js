const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Complaint = require('../models/Complaint');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');
const { notifyUser } = require('../services/notificationService');
const { setAuthCookie, clearAuthCookie } = require('../utils/authCookies');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

const GENERAL_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }
  const errors = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters long');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&* etc.)');
  }
  return { valid: errors.length === 0, errors };
};

// @desc    Get rooms grouped by hostel with occupancy details
// @route   GET /api/admin/rooms
// @access  Private/Admin
exports.getRoomsByHostel = async (req, res) => {
  try {
    const hostelFilter = {};
    const selectedHostel = (req.user?.role === 'warden' && req.user.hostel) 
      ? req.user.hostel 
      : (req.query.hostel && req.query.hostel !== 'all' ? req.query.hostel : null);

    if (selectedHostel) {
      if (selectedHostel.match(/^[0-9a-fA-F]{24}$/)) {
        hostelFilter._id = selectedHostel;
      } else {
        hostelFilter.name = selectedHostel;
      }
    }

    const hostels = await Hostel.find(hostelFilter);
    const result = [];

    for (const hostel of hostels) {
      const rooms = await Room.find({ hostel: hostel._id })
        .populate('occupants', 'firstName lastName email prn role')
        .sort({ floor: 1, roomNumber: 1 });

      const total = rooms.length;
      const fullRooms = rooms.filter(room => room.occupants.length >= room.capacity).length;
      const totalCapacity = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
      const occupiedBeds = rooms.reduce((acc, r) => acc + (r.occupants ? r.occupants.length : 0), 0);
      const availableBeds = Math.max(totalCapacity - occupiedBeds, 0);

      result.push({
        hostel: {
          id: hostel._id,
          name: hostel.name,
          location: hostel.location,
          floors: hostel.floors,
        },
        counts: {
          total,
          occupied: fullRooms,
          available: Math.max(total - fullRooms, 0),
          totalCapacity,
          occupiedBeds,
          availableBeds,
          occupancyPercentage: totalCapacity > 0 ? Math.round((occupiedBeds / totalCapacity) * 100) : 0,
        },
        rooms: rooms.map(room => ({
          id: room._id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          capacity: room.capacity,
          occupants: room.occupants,
          occupantCount: room.occupants.length,
          occupied: room.occupants.length,
          isFull: room.occupants.length >= room.capacity,
          availableSpots: Math.max(room.capacity - room.occupants.length, 0),
          status: room.occupants.length >= room.capacity ? 'FULL' : (room.status || 'AVAILABLE'),
        })),
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Add a student to a room (admin only)
// @route   POST /api/admin/rooms/:roomId/occupants
// @access  Private/Admin
exports.addRoomOccupant = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role !== 'student') {
      return res.status(400).json({ success: false, message: 'Only students can occupy rooms' });
    }

    const room = await Room.findById(req.params.roomId).populate('occupants', 'firstName lastName email prn role');
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.occupants.some(occ => occ._id.toString() === userId)) {
      return res.status(400).json({ success: false, message: 'Student already in this room' });
    }

    if (room.occupants.length >= room.capacity) {
      return res.status(400).json({ success: false, message: 'Room is full' });
    }

    room.occupants.push(userId);
    await room.save();
    const updatedRoom = await Room.recalculateOccupancy(room._id);
    await updatedRoom.populate('occupants', 'firstName lastName email prn role');

    res.status(200).json({ success: true, data: updatedRoom });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Remove a student from a room (admin only)
// @route   DELETE /api/admin/rooms/:roomId/occupants/:userId
// @access  Private/Admin
exports.removeRoomOccupant = async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const room = await Room.findById(roomId).populate('occupants', 'firstName lastName email prn role');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const before = room.occupants.length;
    room.occupants = room.occupants.filter(occ => {
      const occIdStr = (occ && occ._id) ? occ._id.toString() : (occ ? occ.toString() : '');
      return occIdStr !== userId.toString();
    });

    if (room.occupants.length === before) {
      return res.status(404).json({ success: false, message: 'Student not found in this room' });
    }

    await room.save();
    const updatedRoom = await Room.recalculateOccupancy(room._id);
    await updatedRoom.populate('occupants', 'firstName lastName email prn role');

    // Sync student record
    await User.findByIdAndUpdate(userId, {
      $set: { roomNumber: '', floor: '', hostel: '', roomLocked: false }
    });

    res.status(200).json({ success: true, data: updatedRoom });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all users (with pagination and filtering for ~1,000 students)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role && req.query.role !== 'all') filter.role = req.query.role;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.hostel && req.query.hostel !== 'all') filter.hostel = req.query.hostel;
    if (req.query.search) {
      filter.$or = [
        { firstName: new RegExp(req.query.search, 'i') },
        { lastName: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') },
        { prn: new RegExp(req.query.search, 'i') },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('-password')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get dashboard stats with 4-hostel breakdown and filtered operational data
// @route   GET /api/admin/dashboard
// @access  Private/Admin/Warden
exports.getDashboardStats = async (req, res) => {
  try {
    const Outpass = require('../models/Outpass');
    const selectedHostelParam = (req.user?.role === 'warden' && req.user.hostel) 
      ? req.user.hostel 
      : (req.query.hostel && req.query.hostel !== 'all' ? req.query.hostel : null);

    const hostels = await Hostel.find();
    
    // Calculate live real statistics for all 4 hostels
    const hostelsBreakdown = [];
    for (const h of hostels) {
      const rooms = await Room.find({ hostel: h._id });
      const totalCapacity = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
      const occupiedBeds = rooms.reduce((acc, r) => acc + (r.occupants ? r.occupants.length : 0), 0);
      const fullRooms = rooms.filter(r => (r.occupants ? r.occupants.length : 0) >= r.capacity).length;
      const students = await User.countDocuments({ hostel: h.name, role: 'student', status: 'approved' });
      const pendingStudents = await User.countDocuments({ hostel: h.name, role: 'student', status: 'pending' });
      const outpassCount = await Outpass.countDocuments({ hostel: h.name });
      const currentlyOut = await Outpass.countDocuments({ hostel: h.name, status: { $in: ['checked_out', 'used'] } });
      const overdue = await Outpass.countDocuments({ hostel: h.name, status: { $in: ['checked_out', 'used'] }, expectedReturnDate: { $lt: new Date() } });

      hostelsBreakdown.push({
        id: h._id,
        name: h.name,
        location: h.location || 'Campus',
        totalRooms: rooms.length,
        fullRooms,
        availableRooms: rooms.length - fullRooms,
        totalCapacity,
        occupiedBeds,
        availableBeds: Math.max(totalCapacity - occupiedBeds, 0),
        occupancyPercentage: totalCapacity > 0 ? Math.round((occupiedBeds / totalCapacity) * 100) : 0,
        students,
        pendingStudents,
        outpassCount,
        currentlyOut,
        overdue
      });
    }

    // Now compute active stats based on selectedHostelParam
    let filteredRooms = [];
    let userFilter = { role: 'student', status: 'approved' };
    let bookingFilter = {};
    let complaintFilter = {};
    let outpassFilter = {};

    if (selectedHostelParam) {
      const targetHostel = hostels.find(h => h.name === selectedHostelParam || h._id.toString() === selectedHostelParam);
      if (targetHostel) {
        filteredRooms = await Room.find({ hostel: targetHostel._id });
        bookingFilter.hostel = targetHostel._id;
        userFilter.hostel = targetHostel.name;
        complaintFilter.hostel = targetHostel.name;
        outpassFilter.hostel = targetHostel.name;
      } else {
        filteredRooms = await Room.find();
      }
    } else {
      filteredRooms = await Room.find();
    }

    const totalRoomsCount = filteredRooms.length;
    const fullRoomsCount = filteredRooms.filter(r => (r.occupants ? r.occupants.length : 0) >= r.capacity).length;
    const totalCapacityCount = filteredRooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
    const occupiedBedsCount = filteredRooms.reduce((acc, r) => acc + (r.occupants ? r.occupants.length : 0), 0);
    const availableBedsCount = Math.max(totalCapacityCount - occupiedBedsCount, 0);
    const occupancyPercentage = totalCapacityCount > 0 ? Math.round((occupiedBedsCount / totalCapacityCount) * 100) : 0;

    const [
      studentsCount,
      allUsersCount,
      bookingCount,
      confirmedBookings,
      cancelledBookings,
      completedBookings,
      pendingComplaints,
      inProgressComplaints,
      resolvedComplaints,
      rejectedComplaints,
      pendingApprovals,
      activeOutpasses,
      currentlyOutStudents,
      overdueStudents,
      recentBookings,
      adminCount,
      wardenCount,
      securityCount,
      superAdminCount
    ] = await Promise.all([
      User.countDocuments(userFilter),
      selectedHostelParam ? User.countDocuments(userFilter) : User.countDocuments(),
      Booking.countDocuments({ ...bookingFilter, bookingStatus: 'Confirmed' }),
      Booking.countDocuments({ ...bookingFilter, bookingStatus: 'Confirmed' }),
      Booking.countDocuments({ ...bookingFilter, bookingStatus: 'Cancelled' }),
      Booking.countDocuments({ ...bookingFilter, bookingStatus: 'Completed' }),
      Complaint.countDocuments({ ...complaintFilter, status: 'pending' }),
      Complaint.countDocuments({ ...complaintFilter, status: 'in_progress' }),
      Complaint.countDocuments({ ...complaintFilter, status: 'resolved' }),
      Complaint.countDocuments({ ...complaintFilter, status: 'rejected' }),
      User.countDocuments(selectedHostelParam ? { role: 'student', status: 'pending', hostel: selectedHostelParam } : { role: 'student', status: 'pending' }),
      Outpass.countDocuments({ ...outpassFilter, status: { $in: ['pending', 'approved', 'checked_out', 'used'] } }),
      Outpass.countDocuments({ ...outpassFilter, status: { $in: ['checked_out', 'used'] } }),
      Outpass.countDocuments({ ...outpassFilter, status: { $in: ['checked_out', 'used'] }, expectedReturnDate: { $lt: new Date() } }),
      Booking.find(bookingFilter)
        .sort('-createdAt')
        .limit(6)
        .populate('user', 'firstName lastName email prn')
        .populate('room', 'roomNumber type floor')
        .populate('hostel', 'name')
        .then(bookings => bookings.filter(b => b.user !== null)),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'warden' }),
      User.countDocuments({ role: 'security' }),
      User.countDocuments({ role: 'super_admin' })
    ]);

    const totalComplaints = pendingComplaints + inProgressComplaints + resolvedComplaints + rejectedComplaints;

    res.status(200).json({
      success: true,
      data: {
        selectedHostel: selectedHostelParam || 'all',
        hostelsBreakdown,
        counts: {
          users: allUsersCount,
          students: studentsCount,
          hostels: hostels.length,
          rooms: totalRoomsCount,
          totalCapacity: totalCapacityCount,
          occupiedBeds: occupiedBedsCount,
          availableBeds: availableBedsCount,
          occupancyRate: occupancyPercentage,
          occupiedRooms: fullRoomsCount,
          availableRooms: Math.max(totalRoomsCount - fullRoomsCount, 0),
          bookings: bookingCount,
          complaints: totalComplaints,
          pendingStudents: pendingApprovals,
          activeOutpasses,
          outpasses: activeOutpasses,
          currentlyOut: currentlyOutStudents,
          overdue: overdueStudents,
          admins: adminCount,
          wardens: wardenCount,
          security: securityCount,
          superAdmins: superAdminCount
        },
        bookingStats: {
          confirmed: confirmedBookings,
          cancelled: cancelledBookings,
          completed: completedBookings
        },
        complaintStats: {
          pending: pendingComplaints,
          inProgress: inProgressComplaints,
          resolved: resolvedComplaints,
          rejected: rejectedComplaints
        },
        recentBookings
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin (only super_admin can assign super_admin role)
exports.updateUserRole = async (req, res) => {
  try {
    const { role, hostel } = req.body;

    // Validate role - only super_admin can assign super_admin role
    const allowedRoles = req.user.role === 'super_admin'
      ? ['student', 'warden', 'admin', 'security', 'super_admin']
      : ['student', 'warden', 'admin'];

    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid role'
      });
    }

    // Prevent non-super_admin from assigning super_admin role
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super administrators can assign the super administrator role'
      });
    }

    // Safety checks
    if (req.params.id === req.user.id) {
      // Prevent demoting oneself if the user is the only admin/super_admin
      if (role !== 'admin' && role !== 'super_admin') {
        if (role === 'admin') {
          const adminCount = await User.countDocuments({ role: 'admin' });
          const superAdminCount = await User.countDocuments({ role: 'super_admin' });
          if (adminCount <= 1 && superAdminCount === 0) {
            return res.status(400).json({
              success: false,
              message: 'Cannot demote the only remaining administrator',
            });
          }
        } else if (role === 'super_admin') {
          const superAdminCount = await User.countDocuments({ role: 'super_admin' });
          if (superAdminCount <= 1) {
            return res.status(400).json({
              success: false,
              message: 'Cannot demote the only remaining super administrator',
            });
          }
        } else {
          // For other roles, check if user is the only admin or super_admin
          const adminCount = await User.countDocuments({ role: 'admin' });
          const superAdminCount = await User.countDocuments({ role: 'super_admin' });
          if (adminCount <= 1 && superAdminCount === 0) {
            return res.status(400).json({
              success: false,
              message: 'Cannot demote the only remaining administrator/super administrator',
            });
          }
        }
      }
    }

    const updateFields = { role };
    if (hostel !== undefined) {
      updateFields.hostel = hostel;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user is trying to delete themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Protect super admin and protected root system accounts
    if (
      user.role === 'super_admin' ||
      user.email === 'superadmin000@example.com' ||
      user.email === 'admin000@example.com' ||
      user.email === 'superadmin@siu.edu.in' ||
      user.email === 'admin@symbiosis.ac.in'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Protected root system accounts cannot be deleted'
      });
    }

    // Delete ALL bookings associated with this user (cascade delete)
    await Booking.deleteMany({ user: user._id });

    // If student, remove from room occupants
    if (user.role === 'student' && user.hostel && user.floor && user.roomNumber) {
      const hostelDoc = await Hostel.findOne({ 
        $or: [
          { name: new RegExp(user.hostel, 'i') },
          { name: user.hostel }
        ]
      });

      if (hostelDoc) {
        // Remove user from room occupants
        const room = await Room.findOneAndUpdate(
          { 
            hostel: hostelDoc._id, 
            floor: Number.parseInt(user.floor),
            roomNumber: user.roomNumber.toString()
          },
          { 
            $pull: { occupants: user._id }
          },
          { new: true }
        );

        // Update room availability if no occupants
        if (room && room.occupants.length === 0) {
          room.isOccupied = false;
          await room.save();
        }
      }
    }
    
    await user.deleteOne();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Search student by PRN
// @route   GET /api/admin/students/:prn
// @access  Private/Admin
exports.searchStudentByPRN = async (req, res) => {
  try {
    const { prn } = req.params;
    
    const student = await User.findOne({ prn, role: 'student' }).select('-password');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    // Get student's complaints
    const complaints = await Complaint.find({ user: student._id })
      .select('title status createdAt')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: {
        name: `${student.firstName} ${student.lastName}`,
        prn: student.prn,
        email: student.email,
        phone: student.phone || 'N/A',
        hostel: student.hostel || 'N/A',
        floor: student.floor || 'N/A',
        roomNumber: student.roomNumber || 'N/A',
        roomLocked: student.roomLocked,
        roomChangeRequested: student.roomChangeRequested,
        requestedRoom: student.requestedRoom,
        complaints: complaints,
        _id: student._id
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Approve room change request
// @route   PUT /api/admin/students/:id/approve-room-change
// @access  Private/Admin
exports.approveRoomChange = async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await User.findById(id);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    if (!student.roomChangeRequested || !student.requestedRoom) {
      return res.status(400).json({
        success: false,
        message: 'No pending room change request'
      });
    }
    
    // Update room
    student.roomNumber = student.requestedRoom;
    student.roomLocked = true;
    student.requestedRoom = undefined;
    student.roomChangeRequested = false;
    
    await student.save();
    
    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Reject room change request
// @route   PUT /api/admin/students/:id/reject-room-change
// @access  Private/Admin
exports.rejectRoomChange = async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await User.findById(id);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    if (!student.roomChangeRequested) {
      return res.status(400).json({
        success: false,
        message: 'No pending room change request'
      });
    }
    
    // Clear room change request
    student.requestedRoom = undefined;
    student.roomChangeRequested = false;
    
    await student.save();
    
    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Admin / Warden dedicated login
// @route   POST /api/admin/login
// @access  Public
exports.adminLogin = async (req, res) => {
  try {
    const email = req.body && req.body.email;
    const password = req.body && req.body.password;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password as valid strings',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Strict barrier: Student emails can never authenticate through the admin portal
    if (cleanEmail.endsWith('@sitpune.edu.in')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Students cannot authenticate via the Admin Portal. Please use the Student Login portal.',
      });
    }

    // Check for admin, warden, security, or super admin account
    const user = await User.findOne({
      email: cleanEmail,
      role: { $in: ['admin', 'warden', 'security', 'super_admin'] },
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    const token = generateToken(user);

    // Set secure HttpOnly session cookie
    setAuthCookie(res, token);

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        designation: user.designation || '',
        hostel: user.hostel || '',
        phone: user.phone || '',
        token,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error during admin login' });
  }
};

// @desc    Admin / Warden logout & clear cookie
// @route   POST /api/admin/logout
// @access  Public
exports.adminLogout = async (_, res) => {
  clearAuthCookie(res);
  res.status(200).json({
    success: true,
    message: 'Admin logged out successfully',
  });
};

// @desc    Admin / Warden forgot password
// @route   POST /api/admin/forgot-password
// @access  Public
exports.adminForgotPassword = async (_, res) => {
  try {
    const email = _.body && _.body.email;

    if (!email || typeof email !== 'string' || !GENERAL_EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (cleanEmail.endsWith('@sitpune.edu.in')) {
      return res.status(400).json({
        success: false,
        message: 'Students cannot use admin password reset. Please use the Student Forgot Password page.',
      });
    }

    const genericResponse = {
      success: true,
      message: 'If an administrator account with that email exists, a password reset link has been sent to your email.',
    };

    const user = await User.findOne({
      $or: [
        { email: cleanEmail },
        { recoveryEmail: cleanEmail, isRecoveryEmailVerified: true }
      ],
      role: { $in: ['admin', 'warden', 'security', 'super_admin'] },
    });

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    try {
      // Send to registered primary email
      await sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        resetToken,
        isAdmin: true,
      });

      // If user has a verified recovery email, also send to recovery email
      if (user.recoveryEmail && user.isRecoveryEmailVerified && user.recoveryEmail !== user.email) {
        try {
          await sendPasswordResetEmail({
            to: user.recoveryEmail,
            firstName: user.firstName,
            resetToken,
            isAdmin: true,
          });
        } catch (recErr) {
          console.warn('Could not dispatch reset email to recovery address:', recErr.message);
        }
      }
    } catch (mailErr) {
      console.error('Failed to send admin reset email:', mailErr.message);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ success: false, message: 'Could not send reset email. Please try again later.' });
    }

    const responsePayload = { ...genericResponse };
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.resetToken = resetToken;
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Admin forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error during password reset request' });
  }
};

// @desc    Admin / Warden / Security / Super Admin reset password
// @route   POST /api/admin/reset-password/:token, POST /api/admin/reset-password
// @access  Public
exports.adminResetPassword = async (_, res) => {
  try {
    const rawToken = _.params.token || (_.body && _.body.token);
    const password = _.body && _.body.password;

    if (!rawToken || typeof rawToken !== 'string' || !/^[0-9a-f]{64}$/i.test(rawToken.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or malformed password reset token.',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a new password as a valid string.',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpire: { $gt: Date.now() },
      role: { $in: ['admin', 'warden', 'security', 'super_admin'] },
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new reset link.',
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet strength requirements',
        errors: passwordValidation.errors,
      });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(password, salt);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You are now logged in.',
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        token: generateToken(user),
      },
    });
  } catch (error) {
    console.error('Admin reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error during password reset' });
  }
};

// @desc    Get all students pending approval and room allocation
// @route   GET /api/admin/pending-students
// @access  Private/Admin/Warden
exports.getPendingStudents = async (req, res) => {
  try {
    const filter = {
      role: 'student',
      status: 'pending',
    };

    const targetHostel = (req.user?.role === 'warden' && req.user.hostel) 
      ? req.user.hostel 
      : (req.query.hostel && req.query.hostel !== 'all' ? req.query.hostel : null);

    if (targetHostel) {
      filter.$or = [
        { hostel: targetHostel },
        { hostel: { $exists: false } },
        { hostel: '' },
        { hostel: null }
      ];
    }

    const pendingStudents = await User.find(filter)
      .select('-password')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: pendingStudents.length,
      data: pendingStudents,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Approve student and assign hostel, floor, and room atomically
// @route   POST /api/admin/students/:id/approve-and-allocate
// @access  Private/Admin/Warden
exports.approveAndAllocateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { roomId, hostelId, floor, roomNumber } = req.body;

    const student = await User.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.role !== 'student') {
      return res.status(400).json({ success: false, message: 'Only students can be allocated rooms' });
    }

    // Check email verification policy
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !student.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Cannot allocate room to an unverified student. Student must verify their email address first.',
      });
    }

    // Find target room
    let targetRoomQuery = {};
    if (roomId) {
      targetRoomQuery._id = roomId;
    } else if (hostelId && roomNumber) {
      targetRoomQuery.hostel = hostelId;
      targetRoomQuery.roomNumber = roomNumber.toString().trim();
      if (floor !== undefined) {
        targetRoomQuery.floor = Number.parseInt(floor, 10);
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide either roomId or hostelId and roomNumber to allocate',
      });
    }

    const roomDoc = await Room.findOne(targetRoomQuery);
    if (!roomDoc) {
      return res.status(404).json({ success: false, message: 'Target room not found' });
    }

    // ATOMIC ALLOCATION: Only succeeds if current occupant count is strictly less than capacity.
    // Concurrency safe against simultaneous allocation attempts.
    const updatedRoom = await Room.findOneAndUpdate(
      {
        _id: roomDoc._id,
        $expr: { $lt: [{ $size: '$occupants' }, '$capacity'] },
      },
      {
        $addToSet: { occupants: student._id },
      },
      { new: true }
    );

    if (!updatedRoom) {
      return res.status(400).json({
        success: false,
        message: `Room ${roomDoc.roomNumber} is already at maximum capacity (${roomDoc.capacity} students). Allocation prevented.`,
      });
    }

    // Remove student from any previously assigned rooms if re-allocating
    const previousRooms = await Room.find({
      _id: { $ne: updatedRoom._id },
      occupants: student._id,
    });

    await Room.updateMany(
      {
        _id: { $ne: updatedRoom._id },
        occupants: student._id,
      },
      {
        $pull: { occupants: student._id },
      }
    );

    for (const prevRoom of previousRooms) {
      await Room.recalculateOccupancy(prevRoom._id);
    }

    const hostelDoc = await Hostel.findById(updatedRoom.hostel);

    // Update student state
    student.status = 'approved';
    student.hostel = hostelDoc ? hostelDoc.name : student.hostel;
    student.floor = updatedRoom.floor.toString();
    student.roomNumber = updatedRoom.roomNumber.toString();
    student.roomLocked = true;
    student.rejectionReason = '';
    student.roomChangeRequested = false;
    student.requestedRoom = undefined;
    await student.save();

    // Recalculate room occupancy
    await Room.recalculateOccupancy(updatedRoom._id);

    // Create confirmed booking audit record
    const checkInDate = new Date();
    const checkOutDate = new Date();
    checkOutDate.setFullYear(checkOutDate.getFullYear() + 1);

    await Booking.create({
      user: student._id,
      room: updatedRoom._id,
      hostel: updatedRoom.hostel,
      checkInDate,
      checkOutDate,
      totalPrice: updatedRoom.price || 0,
      paymentStatus: 'Paid',
      bookingStatus: 'Confirmed',
    });

    // Notify student of room allocation & approval
    await notifyUser({
      userId: student._id,
      title: 'Room Allocated & Account Approved',
      message: `Congratulations! Your account has been approved and you have been assigned to ${student.hostel} Room ${student.roomNumber}.`,
      type: 'allocation',
      entityId: student._id,
      entityType: 'User',
      hostel: student.hostel,
      roomNumber: student.roomNumber,
    });

    res.status(200).json({
      success: true,
      message: 'Student approved and room allocated successfully',
      data: {
        student: {
          _id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          prn: student.prn,
          phone: student.phone,
          status: student.status,
          hostel: student.hostel,
          floor: student.floor,
          roomNumber: student.roomNumber,
          roomLocked: student.roomLocked,
        },
        room: {
          _id: updatedRoom._id,
          roomNumber: updatedRoom.roomNumber,
          floor: updatedRoom.floor,
          capacity: updatedRoom.capacity,
          occupants: updatedRoom.occupants,
          isOccupied: updatedRoom.isOccupied,
        },
      },
    });
  } catch (error) {
    console.error('Approve and allocate error:', error);
    res.status(500).json({ success: false, message: 'Server error during allocation', error: error.message });
  }
};

// @desc    Reject student registration
// @route   POST /api/admin/students/:id/reject
// @access  Private/Admin/Warden
exports.rejectStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const student = await User.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    student.status = 'rejected';
    student.rejectionReason = (reason && typeof reason === 'string') ? reason.trim() : 'Registration rejected by hostel administration';
    student.roomLocked = false;

    // If student was in any room, remove
    const assignedRooms = await Room.find({ occupants: student._id });
    await Room.updateMany(
      { occupants: student._id },
      { $pull: { occupants: student._id } }
    );
    for (const rm of assignedRooms) {
      await Room.recalculateOccupancy(rm._id);
    }

    student.hostel = '';
    student.floor = '';
    student.roomNumber = '';
    await student.save();

    // Notify student of rejection
    await notifyUser({
      userId: student._id,
      title: 'Registration Status: Rejected',
      message: `Your hostel registration status is: Rejected. Reason: ${student.rejectionReason}`,
      type: 'system',
      entityId: student._id,
      entityType: 'User',
    });

    res.status(200).json({
      success: true,
      message: 'Student registration rejected',
      data: {
        _id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        status: student.status,
        rejectionReason: student.rejectionReason,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Reassign an approved student's room (Admin/Warden authorized action only)
// @route   PUT /api/admin/students/:id/reassign-room
// @access  Private/Admin/Warden
exports.reassignStudentRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { newRoomId, targetRoomId, newHostelId, newFloor, newRoomNumber } = req.body;
    const resolvedTargetRoomId = newRoomId || targetRoomId;

    const student = await User.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.role !== 'student') {
      return res.status(400).json({ success: false, message: 'Only students can be assigned rooms' });
    }

    // Find new target room
    let targetRoomQuery = {};
    if (resolvedTargetRoomId) {
      targetRoomQuery._id = resolvedTargetRoomId;
    } else if (newHostelId && newRoomNumber) {
      targetRoomQuery.hostel = newHostelId;
      targetRoomQuery.roomNumber = newRoomNumber.toString().trim();
      if (newFloor !== undefined) {
        targetRoomQuery.floor = Number.parseInt(newFloor, 10);
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide either newRoomId or newHostelId and newRoomNumber',
      });
    }

    const targetRoomDoc = await Room.findOne(targetRoomQuery);
    if (!targetRoomDoc) {
      return res.status(404).json({ success: false, message: 'Target room not found' });
    }

    // Atomic allocation to new room
    const updatedNewRoom = await Room.findOneAndUpdate(
      {
        _id: targetRoomDoc._id,
        $expr: { $lt: [{ $size: '$occupants' }, '$capacity'] },
      },
      {
        $addToSet: { occupants: student._id },
      },
      { new: true }
    );

    if (!updatedNewRoom) {
      return res.status(400).json({
        success: false,
        message: `Target room ${targetRoomDoc.roomNumber} is already at maximum capacity (${targetRoomDoc.capacity} students). Reassignment prevented.`,
      });
    }

    // Remove from previous rooms
    const previousRooms = await Room.find({
      _id: { $ne: updatedNewRoom._id },
      occupants: student._id,
    });

    await Room.updateMany(
      {
        _id: { $ne: updatedNewRoom._id },
        occupants: student._id,
      },
      {
        $pull: { occupants: student._id },
      }
    );

    for (const prevRoom of previousRooms) {
      await Room.recalculateOccupancy(prevRoom._id);
    }

    const hostelDoc = await Hostel.findById(updatedNewRoom.hostel);

    student.hostel = hostelDoc ? hostelDoc.name : student.hostel;
    student.floor = updatedNewRoom.floor.toString();
    student.roomNumber = updatedNewRoom.roomNumber.toString();
    student.roomLocked = true;
    student.roomChangeRequested = false;
    student.requestedRoom = undefined;
    await student.save();

    await Room.recalculateOccupancy(updatedNewRoom._id);

    // Notify student of reassignment
    await notifyUser({
      userId: student._id,
      title: 'Room Reassigned',
      message: `You have been reassigned to ${student.hostel} Room ${student.roomNumber}.`,
      type: 'allocation',
      entityId: student._id,
      entityType: 'User',
      hostel: student.hostel,
      roomNumber: student.roomNumber,
    });

    res.status(200).json({
      success: true,
      message: 'Student room reassigned successfully',
      data: {
        student: {
          _id: student._id,
          name: `${student.firstName} ${student.lastName}`,
          hostel: student.hostel,
          floor: student.floor,
          roomNumber: student.roomNumber,
        },
        room: {
          _id: updatedNewRoom._id,
          roomNumber: updatedNewRoom.roomNumber,
          floor: updatedNewRoom.floor,
          occupants: updatedNewRoom.occupants,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during reassignment', error: error.message });
  }
};
