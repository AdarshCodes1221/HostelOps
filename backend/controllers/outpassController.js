const QRCode = require('qrcode');
const Outpass = require('../models/Outpass');
const User = require('../models/User');
const { notifyAdmins, notifyUser, notifySecurity } = require('../services/notificationService');

/**
 * Generate QR data URI from opaque pass code URL
 */
const generateQRDataUri = async (passCode, signature) => {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:8080';
  const verifyUrl = `${baseUrl}/verify-outpass?passCode=${encodeURIComponent(passCode)}${
    signature ? `&sig=${encodeURIComponent(signature)}` : ''
  }`;

  return await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 2,
    color: {
      dark: '#1e3a8a', // Deep navy
      light: '#ffffff',
    },
  });
};

// @desc    Create student outpass request
// @route   POST /api/outpass
// @access  Private (Student only)
exports.createOutpass = async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can apply for an outpass',
      });
    }

    if (!req.user.hostel || !req.user.roomNumber) {
      return res.status(400).json({
        success: false,
        message: 'You must have an approved hostel and room allocation before applying for an outpass',
      });
    }

    const {
      reason,
      category,
      destination,
      departureDate,
      expectedReturnDate,
      emergencyContact,
      parentContact,
    } = req.body;

    if (!reason || !destination || !departureDate || !expectedReturnDate || !emergencyContact) {
      return res.status(400).json({
        success: false,
        message: 'Please provide reason, destination, departure date, return date, and emergency contact',
      });
    }

    const depDate = new Date(departureDate);
    const retDate = new Date(expectedReturnDate);

    if (Number.isNaN(depDate.getTime()) || Number.isNaN(retDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid departure or return date format',
      });
    }

    if (retDate <= depDate) {
      return res.status(400).json({
        success: false,
        message: 'Expected return date and time must be after departure date and time',
      });
    }

    const outpass = await Outpass.create({
      student: req.user.id,
      hostel: req.user.hostel,
      roomNumber: req.user.roomNumber,
      reason: reason.trim(),
      category: category || 'home',
      destination: destination.trim(),
      departureDate: depDate,
      expectedReturnDate: retDate,
      emergencyContact: emergencyContact.trim(),
      parentContact: parentContact ? parentContact.trim() : (req.user.emergencyContact || ''),
      status: 'pending',
      requestedAt: new Date(),
      auditLog: [
        {
          event: 'REQUESTED',
          actor: req.user.id,
          actorRole: req.user.role,
          timestamp: new Date(),
          notes: 'Outpass request submitted by student',
        },
      ],
    });

    const populated = await Outpass.findById(outpass._id).populate(
      'student',
      'firstName lastName email prn phone hostel roomNumber'
    );

    // Notify admins & wardens with direct deep-link action URL and strict hostel scoping
    await notifyAdmins({
      title: 'New Outpass Request',
      message: `${req.user.firstName} ${req.user.lastName} (Room ${req.user.roomNumber}, ${req.user.hostel}) requested an outpass for "${outpass.reason}".`,
      type: 'outpass',
      entityId: outpass._id,
      entityType: 'Outpass',
      hostel: req.user.hostel,
      roomNumber: req.user.roomNumber,
      actionUrl: `/admin/dashboard?tab=outpasses&outpassId=${outpass._id}`,
      recipientRoles: ['admin', 'warden', 'super_admin'],
    });

    res.status(201).json({
      success: true,
      message: 'Outpass request submitted successfully',
      data: populated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating outpass',
    });
  }
};

// @desc    Get student's own outpasses (IDOR strictly protected)
// @route   GET /api/outpass/my
// @access  Private (Student)
exports.getMyOutpasses = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const outpasses = await Outpass.find({ student: req.user.id })
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
          obj.qrCodeDataUri = await generateQRDataUri(obj.passCode, obj.qrSignature);
        }

        // Calculate dynamic overdue flag
        obj.isOverdue = (obj.status === 'checked_out' || obj.status === 'used') && now > new Date(obj.expectedReturnDate);

        return obj;
      })
    );

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single outpass by ID (IDOR protected)
// @route   GET /api/outpass/:id
// @access  Private
exports.getOutpassById = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const outpass = await Outpass.findById(req.params.id)
      .populate('student', 'firstName lastName email prn phone hostel roomNumber')
      .populate('approvedBy', 'firstName lastName designation role')
      .populate('rejectedBy', 'firstName lastName')
      .populate('checkedOutBy', 'firstName lastName role')
      .populate('returnedBy', 'firstName lastName role');

    if (!outpass) {
      return res.status(404).json({
        success: false,
        message: 'Outpass not found',
      });
    }

    // IDOR protection: Student can only view their own outpass
    if (req.user.role === 'student' && outpass.student._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this outpass',
      });
    }

    const obj = outpass.toObject({ virtuals: true });
    if (obj.status === 'approved' && obj.passCode) {
      obj.qrCodeDataUri = await generateQRDataUri(obj.passCode, obj.qrSignature);
    }
    const now = new Date();
    obj.isOverdue = (obj.status === 'checked_out' || obj.status === 'used') && now > new Date(obj.expectedReturnDate);

    res.status(200).json({
      success: true,
      data: obj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Outpass Management Statistics (Admin & Warden KPI Dashboard)
// @route   GET /api/outpass/admin/stats
// @access  Private (Admin / Warden)
exports.getOutpassStats = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const activeHostel = (req.user?.role === 'warden' && req.user.hostel) 
      ? req.user.hostel 
      : (req.query.hostel && req.query.hostel !== 'all' ? req.query.hostel : null);

    const baseFilter = {};
    if (activeHostel) {
      baseFilter.hostel = activeHostel;
    }

    const [
      pending,
      approvedToday,
      rejectedToday,
      currentlyOut,
      expectedToday,
      overdue,
      returnedToday,
      total,
    ] = await Promise.all([
      Outpass.countDocuments({ ...baseFilter, status: 'pending' }),
      Outpass.countDocuments({ ...baseFilter, status: 'approved', approvedAt: { $gte: startOfDay } }),
      Outpass.countDocuments({ ...baseFilter, status: 'rejected', rejectedAt: { $gte: startOfDay } }),
      Outpass.countDocuments({ ...baseFilter, status: { $in: ['checked_out', 'used'] } }),
      Outpass.countDocuments({
        ...baseFilter,
        status: { $in: ['checked_out', 'used'] },
        expectedReturnDate: { $gte: startOfDay, $lte: endOfDay },
      }),
      Outpass.countDocuments({
        ...baseFilter,
        status: { $in: ['checked_out', 'used'] },
        expectedReturnDate: { $lt: now },
      }),
      Outpass.countDocuments({
        ...baseFilter,
        status: 'returned',
        returnedAt: { $gte: startOfDay },
      }),
      Outpass.countDocuments(baseFilter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        pending,
        approvedToday,
        rejectedToday,
        currentlyOut,
        expectedToday,
        overdue,
        returnedToday,
        total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all outpasses (Admin and Warden) with pagination & tab filtering
// @route   GET /api/outpass/admin/all
// @access  Private (Admin / Warden)
exports.getAllOutpasses = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const filter = {};

    // Specific Status Filters
    const { status, hostel, search } = req.query;

    if (status && status !== 'all') {
      if (status === 'currently_out' || status === 'checked_out') {
        filter.status = { $in: ['checked_out', 'used'] };
      } else if (status === 'expected') {
        filter.status = { $in: ['checked_out', 'used'] };
        filter.expectedReturnDate = { $gte: startOfDay, $lte: endOfDay };
      } else if (status === 'overdue') {
        filter.status = { $in: ['checked_out', 'used'] };
        filter.expectedReturnDate = { $lt: now };
      } else {
        filter.status = status;
      }
    }

    if (req.user.role === 'warden' && req.user.hostel) {
      filter.hostel = req.user.hostel;
    } else if (hostel && hostel !== 'all') {
      filter.hostel = hostel;
    }

    // Dynamic sort
    let sortQuery = { createdAt: -1 };
    if (status === 'overdue' || status === 'expected') {
      sortQuery = { expectedReturnDate: 1 }; // Soonest due first
    }

    const [total, outpasses] = await Promise.all([
      Outpass.countDocuments(filter),
      Outpass.find(filter)
        .populate('student', 'firstName lastName email prn phone hostel roomNumber')
        .populate('approvedBy', 'firstName lastName designation role')
        .populate('rejectedBy', 'firstName lastName')
        .populate('checkedOutBy', 'firstName lastName role')
        .populate('returnedBy', 'firstName lastName role')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit),
    ]);

    const formatted = await Promise.all(
      outpasses.map(async (p) => {
        const obj = p.toObject({ virtuals: true });
        if (obj.status === 'approved' && obj.passCode) {
          obj.qrCodeDataUri = await generateQRDataUri(obj.passCode, obj.qrSignature);
        }
        obj.isOverdue = (obj.status === 'checked_out' || obj.status === 'used') && now > new Date(obj.expectedReturnDate);
        return obj;
      })
    );

    // If search term provided, filter in memory on populated student name / prn / passCode
    let finalData = formatted;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      finalData = formatted.filter((p) => {
        const studentName = `${p.student?.firstName || ''} ${p.student?.lastName || ''}`.toLowerCase();
        const prn = (p.student?.prn || '').toLowerCase();
        const passCode = (p.passCode || '').toLowerCase();
        const destination = (p.destination || '').toLowerCase();
        return (
          studentName.includes(q) ||
          prn.includes(q) ||
          passCode.includes(q) ||
          destination.includes(q)
        );
      });
    }

    res.status(200).json({
      success: true,
      count: finalData.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: finalData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Approve outpass request and generate digital QR pass
// @route   PUT /api/outpass/admin/:id/approve
// @access  Private (Admin / Warden)
exports.approveOutpass = async (req, res) => {
  try {
    const { adminRemarks } = req.body;
    const outpass = await Outpass.findById(req.params.id);

    if (!outpass) {
      return res.status(404).json({
        success: false,
        message: 'Outpass not found',
      });
    }

    // Hostel isolation: wardens can only approve outpasses from their assigned hostel
    if (req.user.role === 'warden' && req.user.hostel && outpass.hostel && outpass.hostel !== req.user.hostel) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve outpasses outside your assigned hostel',
      });
    }

    if (outpass.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Outpass has already been approved',
      });
    }

    if (outpass.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve an outpass that was already rejected',
      });
    }

    if (outpass.status === 'checked_out' || outpass.status === 'used' || outpass.status === 'returned') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve pass with status: ${outpass.status.toUpperCase()}`,
      });
    }

    // Generate cryptographically secure opaque pass code
    const passCode = Outpass.generatePassCode();
    outpass.passCode = passCode;
    outpass.qrSignature = outpass.signPass();
    outpass.status = 'approved';
    outpass.approvedBy = req.user.id;
    outpass.approvedByRole = req.user.role || 'admin';
    outpass.approvedAt = new Date();
    if (adminRemarks) {
      outpass.adminRemarks = adminRemarks.trim();
    }

    outpass.auditLog.push({
      event: 'APPROVED',
      actor: req.user.id,
      actorRole: req.user.role || 'admin',
      timestamp: new Date(),
      notes: `Outpass approved by ${req.user.firstName || 'Admin'} (${req.user.role})`,
    });
    outpass.auditLog.push({
      event: 'QR_GENERATED',
      actor: req.user.id,
      actorRole: req.user.role || 'admin',
      timestamp: new Date(),
      notes: `PassCode ${passCode} and HMAC QR generated`,
    });

    await outpass.save();

    const populated = await Outpass.findById(outpass._id)
      .populate('student', 'firstName lastName email prn phone hostel roomNumber')
      .populate('approvedBy', 'firstName lastName designation role');

    // Notify student of approval with direct deep link
    await notifyUser({
      userId: outpass.student,
      title: 'Outpass Approved',
      message: `Your outpass to "${outpass.destination}" has been approved! Your digital gate pass code is ${outpass.passCode}.`,
      type: 'outpass_approved',
      entityId: outpass._id,
      entityType: 'Outpass',
      actionUrl: `/outpass?outpassId=${outpass._id}&action=view_qr`,
      hostel: populated.student ? populated.student.hostel : null,
      roomNumber: populated.student ? populated.student.roomNumber : null,
    });

    // Notify gate security officers of approved outpass ready for gate exit
    await notifySecurity({
      title: 'Outpass Approved for Gate Exit',
      message: `${populated.student ? populated.student.firstName + ' ' + populated.student.lastName : 'Student'} (Pass: ${outpass.passCode}) cleared for departure.`,
      type: 'outpass',
      entityId: outpass._id,
      entityType: 'Outpass',
      actionUrl: `/security/dashboard?tab=gate&passCode=${outpass.passCode}`,
      hostel: populated.student ? populated.student.hostel : null,
    });

    const obj = populated.toObject({ virtuals: true });
    obj.qrCodeDataUri = await generateQRDataUri(obj.passCode, obj.qrSignature);

    res.status(200).json({
      success: true,
      message: 'Outpass approved successfully and digital QR gate pass generated',
      data: obj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Reject outpass request
// @route   PUT /api/outpass/admin/:id/reject
// @access  Private (Admin / Warden)
exports.rejectOutpass = async (req, res) => {
  try {
    const { adminRemarks } = req.body;
    const outpass = await Outpass.findById(req.params.id);

    if (!outpass) {
      return res.status(404).json({
        success: false,
        message: 'Outpass not found',
      });
    }

    // Hostel isolation: wardens can only reject outpasses from their assigned hostel
    if (req.user.role === 'warden' && req.user.hostel && outpass.hostel && outpass.hostel !== req.user.hostel) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject outpasses outside your assigned hostel',
      });
    }

    if (outpass.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject an outpass that has already been approved',
      });
    }

    if (outpass.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Outpass is already rejected',
      });
    }

    outpass.status = 'rejected';
    outpass.rejectedBy = req.user.id;
    outpass.rejectedByRole = req.user.role || 'admin';
    outpass.rejectedAt = new Date();
    outpass.adminRemarks = adminRemarks ? adminRemarks.trim() : 'Rejected by hostel administration';

    outpass.auditLog.push({
      event: 'REJECTED',
      actor: req.user.id,
      actorRole: req.user.role || 'admin',
      timestamp: new Date(),
      notes: `Outpass rejected. Reason: ${outpass.adminRemarks}`,
    });

    await outpass.save();

    const populated = await Outpass.findById(outpass._id)
      .populate('student', 'firstName lastName email prn phone hostel roomNumber')
      .populate('rejectedBy', 'firstName lastName');

    // Notify student with direct link
    await notifyUser({
      userId: outpass.student,
      title: 'Outpass Request Rejected',
      message: `Your outpass request to "${outpass.destination}" was rejected. Remarks: ${outpass.adminRemarks}`,
      type: 'outpass',
      entityId: outpass._id,
      entityType: 'Outpass',
      actionUrl: `/outpass?outpassId=${outpass._id}`,
    });

    res.status(200).json({
      success: true,
      message: 'Outpass rejected successfully',
      data: populated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Verify QR digital gate pass (Security Gate / Warden)
// @route   POST /api/outpass/verify-qr
// @access  Public / Security Gate Scanner
exports.verifyOutpassQR = async (req, res) => {
  try {
    const { passCode } = req.body;

    if (!passCode || typeof passCode !== 'string') {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Valid pass code is required for QR gate verification',
      });
    }

    const cleanPassCode = passCode.trim().toUpperCase();
    const outpass = await Outpass.findOne({ passCode: cleanPassCode })
      .populate('student', 'firstName lastName email prn phone hostel roomNumber')
      .populate('approvedBy', 'firstName lastName designation role')
      .populate('checkedOutBy', 'firstName lastName role')
      .populate('returnedBy', 'firstName lastName role');

    if (!outpass) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Invalid QR Gate Pass. Pass code does not exist in registry.',
      });
    }

    // Verify cryptographic signature
    const expectedSig = outpass.signPass();
    if (outpass.qrSignature && outpass.qrSignature !== expectedSig) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'QR Pass cryptographic integrity check failed. Tampered gate pass detected.',
      });
    }

    // Check status
    if (outpass.status === 'rejected') {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Gate Pass REJECTED by administration.',
        data: {
          passCode: outpass.passCode,
          status: 'rejected',
          remarks: outpass.adminRemarks,
        },
      });
    }

    if (outpass.status === 'pending') {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Gate Pass is still PENDING administrative review and is not valid for departure.',
        data: {
          passCode: outpass.passCode,
          status: 'pending',
        },
      });
    }

    if (outpass.status === 'returned') {
      return res.status(400).json({
        success: false,
        valid: false,
        message: `Gate Pass ALREADY CLOSED. Student returned and checked in on ${new Date(outpass.returnedAt).toLocaleString()}.`,
        data: {
          passCode: outpass.passCode,
          status: 'returned',
          returnedAt: outpass.returnedAt,
        },
      });
    }

    const now = new Date();

    // Student is currently checked out
    if (outpass.status === 'checked_out' || outpass.status === 'used') {
      const isOverdue = now > new Date(outpass.expectedReturnDate);

      // If explicit return / checkin action requested by security
      if (req.body.action === 'return' || req.body.action === 'checkin') {
        return res.status(200).json({
          success: true,
          valid: true,
          canCheckOut: false,
          canReturn: true,
          isCurrentlyOut: true,
          isOverdue,
          message: isOverdue
            ? `STUDENT CURRENTLY OUT — OVERDUE! Expected return was ${new Date(outpass.expectedReturnDate).toLocaleString()}. Record return now.`
            : 'STUDENT CURRENTLY OUT. Verified for campus re-entry (Check-In).',
          data: {
            id: outpass._id,
            passCode: outpass.passCode,
            status: 'checked_out',
            studentName: `${outpass.student?.firstName || ''} ${outpass.student?.lastName || ''}`,
            prn: outpass.student?.prn || 'N/A',
            hostel: outpass.hostel,
            roomNumber: outpass.roomNumber,
            category: outpass.category,
            destination: outpass.destination,
            departureDate: outpass.departureDate,
            expectedReturnDate: outpass.expectedReturnDate,
            checkedOutAt: outpass.checkedOutAt || outpass.usedAt,
            isOverdue,
            emergencyContact: outpass.emergencyContact,
          },
        });
      }

      // Default scan at exit gate: Reject reuse for departure
      outpass.auditLog.push({
        event: 'REUSE_ATTEMPTED',
        timestamp: new Date(),
        notes: 'Attempted scan of already used/checked out pass',
      });
      await outpass.save();

      return res.status(400).json({
        success: false,
        valid: false,
        canCheckOut: false,
        canReturn: true,
        message: 'Gate Pass ALREADY USED / ALREADY CHECKED OUT. Single-use campus exit policy enforced.',
        data: {
          id: outpass._id,
          passCode: outpass.passCode,
          status: 'checked_out',
          usedAt: outpass.usedAt || outpass.checkedOutAt,
          canReturn: true,
        },
      });
    }

    // Check expiration before checkout
    if (now > new Date(outpass.expectedReturnDate) || outpass.status === 'expired') {
      outpass.status = 'expired';
      outpass.auditLog.push({
        event: 'EXPIRED_SCAN',
        timestamp: now,
        notes: 'Attempted scan of expired pass',
      });
      await outpass.save();
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Gate Pass has EXPIRED. Expected return timestamp has lapsed without checkout.',
        data: {
          passCode: outpass.passCode,
          status: 'expired',
          expectedReturnDate: outpass.expectedReturnDate,
        },
      });
    }

    // Record verification event
    outpass.auditLog.push({
      event: 'VERIFIED',
      actor: req.user ? req.user.id : null,
      actorRole: req.user ? req.user.role : 'security_gate',
      timestamp: new Date(),
      notes: 'Gate QR scan verified successfully',
    });
    await outpass.save();

    // If status is approved and not expired: VALID GATE PASS FOR CHECKOUT
    res.status(200).json({
      success: true,
      valid: true,
      canCheckOut: true,
      canReturn: false,
      message: 'Gate Pass VERIFIED and VALID for campus departure.',
      data: {
        id: outpass._id,
        passCode: outpass.passCode,
        status: outpass.status,
        studentName: `${outpass.student?.firstName || ''} ${outpass.student?.lastName || ''}`,
        prn: outpass.student?.prn || 'N/A',
        hostel: outpass.hostel,
        roomNumber: outpass.roomNumber,
        category: outpass.category,
        destination: outpass.destination,
        departureDate: outpass.departureDate,
        expectedReturnDate: outpass.expectedReturnDate,
        approvedBy: outpass.approvedBy
          ? `${outpass.approvedBy.firstName} ${outpass.approvedBy.lastName} (${outpass.approvedBy.role})`
          : 'Hostel Administration',
        approvedAt: outpass.approvedAt,
        emergencyContact: outpass.emergencyContact,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      valid: false,
      message: error.message,
    });
  }
};

// Security gate operations have been moved to securityController.js
// This controller now handles only management functions (approve/reject) for wardens and admins
