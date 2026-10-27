const Complaint = require('../models/Complaint');
const { notifyAdmins, notifyUser } = require('../services/notificationService');

// @desc    Create new complaint
// @route   POST /api/complaints
// @access  Private/Student
exports.createComplaint = async (req, res) => {
  try {
    // Only students can create complaints
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit complaints',
      });
    }

    // Enforce that the student has an assigned room
    if (!req.user.hostel || !req.user.roomNumber) {
      return res.status(400).json({
        success: false,
        message: 'You must have an assigned hostel and room to submit a complaint',
      });
    }

    const { title, description, category } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a title and description for the complaint',
      });
    }

    // Always use the authenticated student's assigned hostel, floor, and room.
    // Client-submitted location fields in req.body are strictly ignored to prevent manipulation.
    const complaint = await Complaint.create({
      user: req.user.id,
      title: title.trim(),
      description: description.trim(),
      category: (category || 'maintenance').toLowerCase(),
      hostel: req.user.hostel,
      floor: req.user.floor || '',
      roomNumber: req.user.roomNumber,
    });

    const populatedComplaint = await Complaint.findById(complaint._id).populate(
      'user',
      'firstName lastName email prn'
    );

    // Notify administrators and the assigned hostel's warden
    await notifyAdmins({
      title: 'New Student Complaint',
      message: `${req.user.firstName} filed "${complaint.title}" for ${complaint.hostel} Room ${complaint.roomNumber}.`,
      type: 'complaint',
      entityId: complaint._id,
      entityType: 'Complaint',
      hostel: complaint.hostel,
      roomNumber: complaint.roomNumber,
      actionUrl: `/admin/dashboard?tab=complaints&complaintId=${complaint._id}`,
      recipientRoles: ['admin', 'warden', 'super_admin'],
    });

    res.status(201).json({
      success: true,
      data: populatedComplaint,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get my complaints (Student only - strictly isolated to authenticated user)
// @route   GET /api/complaints/my
// @access  Private/Student
exports.getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ user: req.user.id })
      .populate('user', 'firstName lastName email prn')
      .populate('updatedByAdmin', 'firstName lastName')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single complaint (IDOR protected: students can only see their own)
// @route   GET /api/complaints/:id
// @access  Private
exports.getComplaintById = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    const complaint = await Complaint.findById(req.params.id)
      .populate('user', 'firstName lastName email prn hostel floor roomNumber')
      .populate('updatedByAdmin', 'firstName lastName');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    // IDOR protection: students can only view their own complaint
    if (req.user.role === 'student' && complaint.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this complaint',
      });
    }

    // Hostel isolation: wardens can only view complaints from their assigned hostel
    if (req.user.role === 'warden' && req.user.hostel && complaint.hostel && complaint.hostel !== req.user.hostel) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view complaints outside your assigned hostel',
      });
    }

    res.status(200).json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all complaints (Admin and Warden only, with pagination for 1,000+ students)
// @route   GET /api/admin/complaints
// @access  Private/Admin/Warden
exports.getAllComplaints = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.hostel) {
      filter.hostel = req.query.hostel;
    }

    const [total, complaints] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.find(filter)
        .populate('user', 'firstName lastName email prn hostel floor roomNumber')
        .populate('updatedByAdmin', 'firstName lastName')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      count: complaints.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: complaints,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update complaint status (Admin and Warden only)
// @route   PATCH /api/admin/complaints/:id
// @access  Private/Admin/Warden
exports.updateComplaint = async (req, res) => {
  try {
    const { status, assignedDepartment, adminNotes } = req.body;

    let complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
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
    if (complaint.user) {
      const studentId = complaint.user._id || complaint.user;
      await notifyUser({
        userId: studentId,
        title: `Complaint Status: ${complaint.title}`,
        message: `Your complaint status has been updated to "${status || complaint.status}".`,
        type: 'complaint',
        entityId: complaint._id,
        entityType: 'Complaint',
      });
    }

    res.status(200).json({
      success: true,
      data: updatedComplaint,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete complaint (Admin only)
// @route   DELETE /api/admin/complaints/:id
// @access  Private/Admin
exports.deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    await complaint.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Complaint deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
