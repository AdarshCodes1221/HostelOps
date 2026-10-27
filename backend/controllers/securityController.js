const Outpass = require('../models/Outpass');
const User = require('../models/User');
const { notifyUser } = require('../services/notificationService');
const QRCode = require('qrcode');

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

// @desc    Verify QR digital gate pass (Security Gate Only)
// @route   POST /api/outpass/verify-qr
// @access  Private / Security
exports.verifyOutpassQR = async (req, res) => {
  try {
    // Security role check
    if (req.user.role !== 'security') {
      return res.status(403).json({
        success: false,
        message: 'Only security personnel can verify gate passes',
      });
    }

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
      actor: req.user.id,
      actorRole: req.user.role,
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

// @desc    Gate Check-Out (Student exits campus) - Security Only
// @route   POST /api/outpass/checkout
// @access  Private / Security
exports.checkoutOutpass = async (req, res) => {
  try {
    // Security role check
    if (req.user.role !== 'security') {
      return res.status(403).json({
        success: false,
        message: 'Only security personnel can perform gate check-out operations',
      });
    }

    const { passCode } = req.body;
    if (!passCode) {
      return res.status(400).json({
        success: false,
        message: 'Pass code is required for gate check-out',
      });
    }

    const mongoose = require('mongoose');
    let outpass;
    if (mongoose.Types.ObjectId.isValid(passCode)) {
      outpass = await Outpass.findById(passCode);
    } else {
      outpass = await Outpass.findOne({ passCode: passCode.toString().trim().toUpperCase() });
    }

    if (!outpass) {
      return res.status(404).json({
        success: false,
        message: 'Outpass not found',
      });
    }

    if (outpass.status === 'checked_out' || outpass.status === 'used') {
      return res.status(400).json({
        success: false,
        message: 'ALREADY CHECKED OUT. This student has already departed through the gate.',
      });
    }

    if (outpass.status === 'returned') {
      return res.status(400).json({
        success: false,
        message: 'PASS ALREADY CLOSED. Student has already returned and closed this pass.',
      });
    }

    if (outpass.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Cannot check out outpass with status: ${outpass.status.toUpperCase()}`,
      });
    }

    const now = new Date();
    outpass.status = 'checked_out';
    outpass.checkedOutAt = now;
    outpass.usedAt = now; // Compatibility with legacy 'used'
    outpass.checkedOutBy = req.user.id;
    outpass.checkedOutByRole = req.user.role;
    outpass.verifiedBy = req.user.id;

    outpass.auditLog.push({
      event: 'CHECKED_OUT',
      actor: req.user.id,
      actorRole: req.user.role,
      timestamp: now,
      notes: 'Campus departure verified and checked out at gate',
    });

    await outpass.save();

    // Notify student of departure recording
    await notifyUser({
      userId: outpass.student,
      title: 'Gate Departure Recorded',
      message: `Your campus exit was recorded at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Expected return: ${new Date(outpass.expectedReturnDate).toLocaleString()}.`,
      type: 'outpass',
      entityId: outpass._id,
      entityType: 'Outpass',
      actionUrl: `/outpass?outpassId=${outpass._id}`,
    });

    res.status(200).json({
      success: true,
      message: 'CHECK-OUT SUCCESSFUL. Student departure verified and marked as CURRENTLY OUT.',
      data: {
        id: outpass._id,
        passCode: outpass.passCode,
        status: outpass.status,
        checkedOutAt: outpass.checkedOutAt,
        usedAt: outpass.usedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Gate Check-In / Return (Student returns to campus) - Security Only
// @route   POST /api/outpass/return
// @access  Private / Security
exports.returnOutpass = async (req, res) => {
  try {
    // Security role check
    if (req.user.role !== 'security') {
      return res.status(403).json({
        success: false,
        message: 'Only security personnel can perform gate return operations',
      });
    }

    const { passCode } = req.body;
    if (!passCode) {
      return res.status(400).json({
        success: false,
        message: 'Pass code is required for gate return',
      });
    }

    const mongoose = require('mongoose');
    let outpass;
    if (mongoose.Types.ObjectId.isValid(passCode)) {
      outpass = await Outpass.findById(passCode);
    } else {
      outpass = await Outpass.findOne({ passCode: passCode.toString().trim().toUpperCase() });
    }

    if (!outpass) {
      return res.status(404).json({
        success: false,
        message: 'Outpass not found',
      });
    }

    if (outpass.status === 'returned') {
      return res.status(400).json({
        success: false,
        message: 'Student return has already been recorded for this pass.',
      });
    }

    if (outpass.status !== 'checked_out' && outpass.status !== 'used') {
      return res.status(400).json({
        success: false,
        message: `Cannot record return: Pass status is ${outpass.status.toUpperCase()} (student has not checked out yet).`,
      });
    }

    const now = new Date();
    outpass.status = 'returned';
    outpass.returnedAt = now;
    outpass.returnedBy = req.user.id;
    outpass.returnedByRole = req.user.role;

    outpass.auditLog.push({
      event: 'RETURNED',
      actor: req.user.id,
      actorRole: req.user.role,
      timestamp: now,
      notes: 'Student return to campus verified and recorded by security gate',
    });

    await outpass.save();

    // Notify student of return recording
    await notifyUser({
      userId: outpass.student,
      title: 'Hostel Return Confirmed',
      message: `Your return to hostel has been verified by gate security. Gate pass is now closed.`,
      type: 'outpass',
      entityId: outpass._id,
      entityType: 'Outpass',
      actionUrl: `/outpass?outpassId=${outpass._id}`,
    });

    res.status(200).json({
      success: true,
      message: 'RETURN SUCCESSFUL. Student re-entry recorded and pass closed.',
      data: {
        id: outpass._id,
        passCode: outpass.passCode,
        status: outpass.status,
        returnedAt: outpass.returnedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Gate Attendance & Movement Logs - Security Only
// @route   GET /api/outpass/admin/attendance
// @access  Private / Security
exports.getGateAttendance = async (req, res) => {
  try {
    // Security, Admin, Super Admin, Warden role check
    if (!['security', 'admin', 'super_admin', 'warden'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only authorized security and management personnel can access gate attendance logs',
      });
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const { date, hostel, status } = req.query;
    const now = new Date();

    const targetDate = date ? new Date(date) : now;
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const query = {
      $or: [
        { checkedOutAt: { $gte: startOfDay, $lte: endOfDay } },
        { returnedAt: { $gte: startOfDay, $lte: endOfDay } },
        { status: { $in: ['checked_out', 'used'] } },
      ],
    };

    const activeHostel = (req.user.role === 'warden' && req.user.hostel) ? req.user.hostel : (hostel && hostel !== 'all' ? hostel : null);
    if (activeHostel) {
      query.hostel = activeHostel;
    }

    const records = await Outpass.find(query)
      .populate('student', 'firstName lastName prn phone hostel roomNumber')
      .populate('checkedOutBy', 'firstName lastName role')
      .populate('returnedBy', 'firstName lastName role')
      .sort({ updatedAt: -1 });

    const movements = records.map((r) => {
      const isOverdue = (r.status === 'checked_out' || r.status === 'used') && now > new Date(r.expectedReturnDate);
      let displayStatus = 'CURRENTLY OUT';
      if (r.status === 'returned') displayStatus = 'RETURNED';
      else if (isOverdue) displayStatus = 'OVERDUE';

      return {
        id: r._id,
        passCode: r.passCode,
        studentName: `${r.student?.firstName || ''} ${r.student?.lastName || ''}`,
        prn: r.student?.prn || 'N/A',
        hostel: r.hostel,
        roomNumber: r.roomNumber,
        destination: r.destination,
        date: r.checkedOutAt ? new Date(r.checkedOutAt).toLocaleDateString() : new Date(r.createdAt).toLocaleDateString(),
        outTime: r.checkedOutAt ? new Date(r.checkedOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        expectedReturn: new Date(r.expectedReturnDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        returnTime: r.returnedAt ? new Date(r.returnedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        status: displayStatus,
        verifiedBy: r.returnedBy ? `${r.returnedBy.firstName} (${r.returnedBy.role})` : (r.checkedOutBy ? `${r.checkedOutBy.firstName} (${r.checkedOutBy.role})` : 'Security Officer'),
      };
    });

    // Summary counts derived from live DB, filtered by activeHostel if provided
    const studentFilter = { role: 'student', status: 'approved' };
    const outpassFilter = {};
    if (activeHostel) {
      studentFilter.hostel = activeHostel;
      outpassFilter.hostel = activeHostel;
    }

    const [totalUsers, currentlyOutCount, returnedCount, overdueCount, approvedCount, pendingCount] = await Promise.all([
      User.countDocuments(studentFilter),
      Outpass.countDocuments({ ...outpassFilter, status: { $in: ['checked_out', 'used'] } }),
      Outpass.countDocuments({ ...outpassFilter, status: 'returned', returnedAt: { $gte: startOfDay } }),
      Outpass.countDocuments({ ...outpassFilter, status: { $in: ['checked_out', 'used'] }, expectedReturnDate: { $lt: now } }),
      Outpass.countDocuments({ ...outpassFilter, status: 'approved' }),
      Outpass.countDocuments({ ...outpassFilter, status: 'pending' }),
    ]);

    const summary = {
      totalStudents: totalUsers,
      onCampus: Math.max(0, totalUsers - currentlyOutCount),
      currentlyOut: currentlyOutCount,
      returned: returnedCount,
      overdue: overdueCount,
      approvedLeave: approvedCount,
      pendingRequests: pendingCount,
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        movements,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = exports;