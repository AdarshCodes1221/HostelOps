const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Complaint = require('../models/Complaint');
const Outpass = require('../models/Outpass');
const jwt = require('jsonwebtoken');
const { notifyUser } = require('../services/notificationService');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

// @desc    Get warden's hostel details
// @route   GET /api/warden/hostel
// @access  Private/Warden
exports.getWardenHostel = async (req, res) => {
  try {
    // Use hostel information set by middleware
    const hostelName = req.wardenHostel;

    if (!hostelName) {
      return res.status(404).json({
        success: false,
        message: 'No hostel assigned to this warden'
      });
    }

    // Find hostel by name
    const hostel = await Hostel.findOne({ name: hostelName });

    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }

    res.status(200).json({
      success: true,
      data: hostel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get students in warden's hostel
// @route   GET /api/warden/students
// @access  Private/Warden
exports.getHostelStudents = async (req, res) => {
  try {
    // Use hostel information set by middleware
    const hostelName = req.wardenHostel;

    if (!hostelName) {
      return res.status(404).json({
        success: false,
        message: 'No hostel assigned to this warden'
      });
    }

    // Get students in this hostel
    const students = await User.find({
      role: 'student',
      hostel: hostelName
    }).select('-password');

    res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get pending students in warden's hostel
// @route   GET /api/warden/pending-students
// @access  Private/Warden
exports.getPendingHostelStudents = async (req, res) => {
  try {
    // Use hostel information set by middleware
    const hostelName = req.wardenHostel;

    if (!hostelName) {
      return res.status(404).json({
        success: false,
        message: 'No hostel assigned to this warden'
      });
    }

    // Get pending students in this hostel
    const pendingStudents = await User.find({
      role: 'student',
      hostel: hostelName,
      status: 'pending'
    }).select('-password');

    res.status(200).json({
      success: true,
      count: pendingStudents.length,
      data: pendingStudents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Approve and allocate student in warden's hostel
// @route   POST /api/warden/students/:id/approve-and-allocate
// @access  Private/Warden
exports.approveAndAllocateHostelStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { roomId, hostelId, floor, roomNumber } = req.body;

    // Use hostel information set by middleware
    const hostelName = req.wardenHostel;

    if (!hostelName) {
      return res.status(404).json({
        success: false,
        message: 'No hostel assigned to this warden'
      });
    }

    // Find hostel by name to get the hostel object
    const hostel = await Hostel.findOne({ name: hostelName });
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }

    const student = await User.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.role !== 'student') {
      return res.status(400).json({ success: false, message: 'Only students can be allocated rooms' });
    }

    // Ensure student belongs to warden's hostel
    if (student.hostel !== hostelName) {
      return res.status(403).json({
        success: false,
        message: 'Student does not belong to your hostel'
      });
    }

    // Check email verification policy
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !student.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Cannot allocate room to an unverified student. Student must verify their email address first.',
      });
    }

    // Find target room - ensure it's in warden's hostel
    let targetRoomQuery = {};
    if (roomId) {
      targetRoomQuery._id = roomId;
    } else if (hostelId && roomNumber) {
      targetRoomQuery.hostel = hostelId;
      targetRoomQuery.roomNumber = roomNumber.toString().trim();
      if (floor !== undefined) {
        targetRoomQuery.floor = parseInt(floor, 10);
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide either roomId or hostelId and roomNumber to allocate',
      });
    }

    // Ensure the room belongs to warden's hostel
    targetRoomQuery.hostel = hostel._id;

    const roomDoc = await Room.findOne(targetRoomQuery);
    if (!roomDoc) {
      return res.status(404).json({ success: false, message: 'Target room not found in your hostel' });
    }

    // ATOMIC ALLOCATION: Only succeeds if current occupant count is strictly less than capacity.
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

    // Update student state
    student.status = 'approved';
    student.hostel = hostelName;
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

// @desc    Reject student registration in warden's hostel
// @route   POST /api/warden/students/:id/reject
// @access  Private/Warden
exports.rejectHostelStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Use hostel information set by middleware
    const hostelName = req.wardenHostel;

    if (!hostelName) {
      return res.status(404).json({
        success: false,
        message: 'No hostel assigned to this warden'
      });
    }

    // Find hostel by name to get the hostel object
    const hostel = await Hostel.findOne({ name: hostelName });
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }

    const student = await User.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Ensure student belongs to warden's hostel
    if (student.hostel !== hostelName) {
      return res.status(403).json({
        success: false,
        message: 'Student does not belong to your hostel'
      });
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

// @desc    Get complaints in warden's hostel
// @route   GET /api/warden/complaints
// @access  Private/Warden
exports.getHostelComplaints = async (req, res) => {
  try {
    // Use hostel information set by middleware
    const hostelName = req.wardenHostel;

    if (!hostelName) {
      return res.status(404).json({
        success: false,
        message: 'No hostel assigned to this warden'
      });
    }

    // Find hostel by name to get the hostel object
    const hostel = await Hostel.findOne({ name: hostelName });
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }

    // Get complaints in this hostel
    const complaints = await Complaint.find({ hostel: hostelName })
      .populate('user', 'firstName lastName email prn')
      .populate('updatedByAdmin', 'firstName lastName')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update complaint status (Warden only for their hostel)
// @route   PATCH /api/warden/complaints/:id
// @access  Private/Warden
exports.updateHostelComplaint = async (req, res) => {
  try {
    const { status, assignedDepartment, adminNotes } = req.body;

    // Use hostel information set by middleware
    const hostelName = req.wardenHostel;

    if (!hostelName) {
      return res.status(404).json({
        success: false,
        message: 'No hostel assigned to this warden'
      });
    }

    // Find hostel by name to get the hostel object
    const hostel = await Hostel.findOne({ name: hostelName });
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }

    let complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Ensure complaint belongs to warden's hostel
    if (complaint.hostel !== hostelName) {
      return res.status(403).json({
        success: false,
        message: 'Complaint does not belong to your hostel'
      });
    }

    if (status) complaint.status = status;
    if (assignedDepartment) complaint.assignedDepartment = assignedDepartment;
    if (adminNotes !== undefined) complaint.adminNotes = adminNotes;
    complaint.updatedByAdmin = req.user.id;

    await complaint.save();

    const updatedComplaint = await Complaint.findById(complaint._id)
      .populate('user', 'firstName lastName email prn hostel floor roomNumber')
      .populate('updatedByAdmin', 'firstName lastName');

    // Notify student of status update
    if (updatedComplaint.user) {
      const studentId = updatedComplaint.user._id || updatedComplaint.user;
      await notifyUser({
        userId: studentId,
        title: `Complaint Status: ${updatedComplaint.title}`,
        message: `Your complaint status has been updated to "${status || updatedComplaint.status}".`,
        type: 'complaint',
        entityId: updatedComplaint._id,
        entityType: 'Complaint',
      });
    }

    res.status(200).json({
      success: true,
      data: updatedComplaint
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get outpasses in warden's hostel
// @route   GET /api/warden/outpasses
// @access  Private/Warden
exports.getHostelOutpasses = async (req, res) => {
  try {
    // Use hostel information set by middleware
    const hostelName = req.wardenHostel;

    if (!hostelName) {
      return res.status(404).json({
        success: false,
        message: 'No hostel assigned to this warden'
      });
    }

    // Find hostel by name to get the hostel object
    const hostel = await Hostel.findOne({ name: hostelName });
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }

    // Get outpasses in this hostel
    const outpasses = await Outpass.find({ hostel: hostelName })
      .populate('student', 'firstName lastName email prn phone hostel roomNumber')
      .populate('approvedBy', 'firstName lastName designation role')
      .populate('rejectedBy', 'firstName lastName')
      .populate('checkedOutBy', 'firstName lastName role')
      .populate('returnedBy', 'firstName lastName role')
      .sort('-createdAt');

    const now = new Date();
    const formatted = await Promise.all(
      outpasses.map(async (p) => {
        const obj = p.toObject({ virtuals: true });

        // Auto expire check if approved but past return date without checkout
        if (obj.status === 'approved' && now > new Date(obj.expectedReturnDate)) {
          obj.status = 'expired';
          p.status = 'expired';
          p.auditLog.push({
            event: 'EXPIRED_SCAN',
            timestamp: now,
            notes: 'Auto-expired: expected return passed without departure',
          });
          await p.save();
        }

        // Attach QR data URI if approved
        if (obj.status === 'approved' && obj.passCode) {
          // QR generation would happen here if needed
        }

        // Calculate dynamic overdue flag
        obj.isOverdue = (obj.status === 'checked_out' || obj.status === 'used') && now > new Date(obj.expectedReturnDate);

        return obj;
      })
    );

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get dashboard stats for warden's hostel
// @route   GET /api/warden/dashboard
// @access  Private/Warden
exports.getHostelDashboardStats = async (req, res) => {
  try {
    // Use hostel information set by middleware
    const hostelName = req.wardenHostel;

    if (!hostelName) {
      return res.status(404).json({
        success: false,
        message: 'No hostel assigned to this warden'
      });
    }

    // Find hostel by name to get the hostel object
    const hostel = await Hostel.findOne({ name: hostelName });
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }

    // Get stats for this hostel only
    const rooms = await Room.find({ hostel: hostel._id });
    const totalRooms = rooms.length;
    let totalCapacity = 0;
    let totalOccupants = 0;

    rooms.forEach(room => {
      const occCount = (room.occupants || []).length;
      totalCapacity += room.capacity;
      totalOccupants += occCount;
    });

    const userCount = await User.countDocuments({ role: 'student', hostel: hostelName });
    const pendingUserCount = await User.countDocuments({ role: 'student', hostel: hostelName, status: 'pending' });
    const complaintCount = await Complaint.countDocuments({ hostel: hostelName });
    const outpassCount = await Outpass.countDocuments({ hostel: hostelName });

    // Get booking counts for this hostel
    const bookingCount = await Booking.countDocuments({ hostel: hostel._id });

    res.status(200).json({
      success: true,
      data: {
        counts: {
          users: userCount,
          pendingUsers: pendingUserCount,
          rooms: totalRooms,
          capacity: totalCapacity,
          occupants: totalOccupants,
          availableSpots: Math.max(totalCapacity - totalOccupants, 0),
          bookings: bookingCount,
          complaints: complaintCount,
          outpasses: outpassCount
        },
        occupancyRate: totalCapacity > 0 ? Math.round((totalOccupants / totalCapacity) * 100) : 0
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

module.exports = exports;