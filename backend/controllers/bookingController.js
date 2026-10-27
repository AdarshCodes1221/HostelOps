const Booking = require('../models/Booking');
const Room = require('../models/Room');

// @desc    Get all bookings (Isolated to student's own bookings; admins/wardens see all)
// @route   GET /api/bookings
// @access  Private
exports.getBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    // If student, strictly isolate query to authenticated user's ID
    if (req.user.role === 'student') {
      filter.user = req.user.id;
    }

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.find(filter)
        .populate({
          path: 'user',
          select: 'firstName lastName email prn',
        })
        .populate({
          path: 'room',
          select: 'roomNumber type price floor',
        })
        .populate({
          path: 'hostel',
          select: 'name address city',
        })
        .sort('-createdAt')
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get single booking (IDOR protected)
// @route   GET /api/bookings/:id
// @access  Private
exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'firstName lastName email prn',
      })
      .populate({
        path: 'room',
        select: 'roomNumber type price floor',
      })
      .populate({
        path: 'hostel',
        select: 'name address city',
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // IDOR protection: Student can only view their own booking
    if (req.user.role === 'student' && booking.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this booking',
      });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new booking (auto-assign available room)
// @route   POST /api/bookings
// @access  Private
exports.createBooking = async (req, res) => {
  try {
    const userId = req.user.role === 'student' ? req.user.id : (req.body.user || req.user.id);
    const hostelId = req.body.hostel;

    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'Hostel is required for booking' });
    }

    const checkInDate = new Date(req.body.checkInDate);
    const checkOutDate = new Date(req.body.checkOutDate);
    const days = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    if (!req.body.checkInDate || !req.body.checkOutDate || Number.isNaN(days)) {
      return res.status(400).json({ success: false, message: 'Check-in and check-out dates are required' });
    }

    if (days <= 0) {
      return res.status(400).json({ success: false, message: 'Check-out date must be after check-in date' });
    }

    // Atomically grab a room with available capacity and add the student
    const room = await Room.findOneAndUpdate(
      { hostel: hostelId, $expr: { $lt: [{ $size: '$occupants' }, '$capacity'] } },
      { $addToSet: { occupants: userId } },
      { new: true, sort: { roomNumber: 1 } }
    );

    if (!room) {
      return res.status(400).json({ success: false, message: 'No available rooms in this hostel' });
    }

    await Room.recalculateOccupancy(room._id);

    const booking = await Booking.create({
      user: userId,
      room: room._id,
      hostel: hostelId,
      checkInDate,
      checkOutDate,
      totalPrice: days * (room.price || 0),
      paymentStatus: 'Paid',
      bookingStatus: 'Confirmed',
    });

    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update booking (Mass assignment & IDOR protected)
// @route   PUT /api/bookings/:id
// @access  Private
exports.updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Ownership check
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this booking',
      });
    }

    // Students are NOT allowed to modify prices, payment status, or arbitrarily confirm bookings
    if (req.user.role === 'student') {
      if (req.body.bookingStatus && req.body.bookingStatus !== 'Cancelled') {
        return res.status(403).json({
          success: false,
          message: 'Students can only cancel bookings. Other status changes require administrator approval.',
        });
      }
      if (req.body.totalPrice !== undefined || req.body.paymentStatus !== undefined || req.body.room !== undefined) {
        return res.status(403).json({
          success: false,
          message: 'Students cannot modify room pricing or payment details',
        });
      }

      booking.bookingStatus = 'Cancelled';
      booking.paymentStatus = 'Cancelled';
      await booking.save();

      await Room.findByIdAndUpdate(booking.room, { $pull: { occupants: booking.user } });
      await Room.recalculateOccupancy(booking.room);

      return res.status(200).json({ success: true, data: booking });
    }

    // Admin updates
    const previousRoomId = booking.room;
    const updated = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    const statusNow = req.body.bookingStatus || updated.bookingStatus;
    if (['Cancelled', 'Completed'].includes(statusNow)) {
      await Room.findByIdAndUpdate(previousRoomId, { $pull: { occupants: booking.user } });
      await Room.recalculateOccupancy(previousRoomId);
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Confirm booking (Admin only)
// @route   PUT /api/admin/bookings/:id/confirm
// @access  Private/Admin
exports.confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    booking.bookingStatus = 'Confirmed';
    booking.paymentStatus = 'Paid';
    await booking.save();

    const populatedBooking = await booking.populate([
      { path: 'user', select: 'firstName lastName email prn' },
      { path: 'room', select: 'roomNumber type floor' },
      { path: 'hostel', select: 'name' },
    ]);

    res.status(200).json({
      success: true,
      data: populatedBooking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Cancel booking (Admin only)
// @route   PUT /api/admin/bookings/:id/cancel
// @access  Private/Admin
exports.cancelBookingAdmin = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    booking.bookingStatus = 'Cancelled';
    booking.paymentStatus = 'Cancelled';
    await booking.save();

    await Room.findByIdAndUpdate(booking.room, { $pull: { occupants: booking.user } });
    await Room.recalculateOccupancy(booking.room);

    res.status(200).json({
      success: true,
      message: 'Booking cancelled by admin',
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Cancel booking (Student cancelling own booking)
// @route   DELETE /api/bookings/:id
// @access  Private
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking',
      });
    }

    booking.bookingStatus = 'Cancelled';
    booking.paymentStatus = 'Cancelled';
    await booking.save();

    await Room.findByIdAndUpdate(booking.room, { $pull: { occupants: booking.user } });
    await Room.recalculateOccupancy(booking.room);

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};