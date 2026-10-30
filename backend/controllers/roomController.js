const Room = require('../models/Room');
const Hostel = require('../models/Hostel');

// Helper to sanitize room data for non-admins/wardens
const sanitizeRoomForStudent = (roomDoc) => {
  const room = roomDoc.toObject ? roomDoc.toObject() : { ...roomDoc };
  // Hide personal identities of other student occupants
  delete room.occupants;
  return room;
};

// @desc    Get all rooms (Public / Students see available spots; Admin / Warden sees occupants)
// @route   GET /api/rooms
// @access  Public (Optional auth for admin view)
exports.getRooms = async (req, res) => {
  try {
    const isStaff = req.user && (req.user.role === 'admin' || req.user.role === 'warden');
    const reqQuery = { ...req.query };
    const removeFields = ['select', 'sort', 'page', 'limit'];
    removeFields.forEach(param => delete reqQuery[param]);

    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    let query = Room.find(JSON.parse(queryStr)).populate('hostel');

    if (isStaff) {
      query = query.populate('occupants', 'firstName lastName email prn role');
    }

    if (req.query.select) {
      const fields = req.query.select.replaceAll(',', ' ');
      query = query.select(fields);
    }

    if (req.query.sort) {
      const sortBy = req.query.sort.replaceAll(',', ' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort({ floor: 1, roomNumber: 1 });
    }

    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 30;
    const startIndex = (page - 1) * limit;
    const total = await Room.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    const rooms = await query;
    const data = isStaff ? rooms : rooms.map(sanitizeRoomForStudent);

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get single room
// @route   GET /api/rooms/:id
// @access  Public (Optional auth)
exports.getRoom = async (req, res) => {
  try {
    const isStaff = req.user && (req.user.role === 'admin' || req.user.role === 'warden');
    let query = Room.findById(req.params.id).populate('hostel');

    if (isStaff) {
      query = query.populate('occupants', 'firstName lastName email prn role');
    }

    const room = await query;

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    res.status(200).json({
      success: true,
      data: isStaff ? room : sanitizeRoomForStudent(room),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new room (integer-style room numbers e.g. 101, 102, 201)
// @route   POST /api/rooms or POST /api/hostels/:hostelId/rooms
// @access  Private/Admin
exports.createRoom = async (req, res) => {
  try {
    const hostelId = req.params.hostelId || req.body.hostel || req.body.hostelId;
    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'Please provide a valid hostel' });
    }

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: `No hostel with the id of ${hostelId}`,
      });
    }

    const { roomNumber, floor, capacity, price, amenities } = req.body;
    if (!roomNumber) {
      return res.status(400).json({ success: false, message: 'Please provide a room number (e.g. 101, 102)' });
    }

    const cleanRoomNumber = roomNumber.toString().trim();
    // Validate proper integer-style numbering format (e.g. 101, 102, 201, 1001)
    if (!/^\d{2,4}$/.test(cleanRoomNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Room number must use proper integer-style numbering (e.g. 101, 102, 201). Random codes are not allowed.',
      });
    }

    // Check for duplicate room in this hostel
    const existingRoom = await Room.findOne({ hostel: hostel._id, roomNumber: cleanRoomNumber });
    if (existingRoom) {
      return res.status(400).json({
        success: false,
        message: `Room ${cleanRoomNumber} already exists in ${hostel.name}`,
      });
    }

    const roomFloor = floor !== undefined ? Number.parseInt(floor, 10) : Number.parseInt(cleanRoomNumber.charAt(0), 10);
    const roomCapacity = capacity !== undefined ? Number.parseInt(capacity, 10) : 3;

    if (Number.isNaN(roomCapacity) || roomCapacity < 1) {
      return res.status(400).json({ success: false, message: 'Room capacity must be at least 1' });
    }

    const room = await Room.create({
      hostel: hostel._id,
      roomNumber: cleanRoomNumber,
      floor: Number.isNaN(roomFloor) ? 1 : roomFloor,
      capacity: roomCapacity,
      price: price || 0,
      amenities: amenities || [],
      occupants: [],
      status: 'AVAILABLE',
      isOccupied: false,
    });

    res.status(201).json({
      success: true,
      data: room,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update room
// @route   PUT /api/rooms/:id
// @access  Private/Admin
exports.updateRoom = async (req, res) => {
  try {
    let room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    if (req.body.capacity && req.body.capacity < (room.occupants || []).length) {
      return res.status(400).json({ success: false, message: 'Capacity cannot be less than current occupants' });
    }

    room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await Room.recalculateOccupancy(room._id);
    room = await Room.findById(req.params.id)
      .populate('hostel')
      .populate('occupants', 'firstName lastName email prn role');

    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete room
// @route   DELETE /api/rooms/:id
// @access  Private/Admin
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    if ((room.occupants || []).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete room with active occupants. Reassign students first.',
      });
    }

    await room.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get available rooms
// @route   GET /api/rooms/available
// @access  Public (Optional auth)
exports.getAvailableRooms = async (req, res) => {
  try {
    const isStaff = req.user && (req.user.role === 'admin' || req.user.role === 'warden');
    const filter = req.query.hostel ? { hostel: req.query.hostel } : {};

    let query = Room.find({
      ...filter,
      $expr: { $lt: [{ $size: '$occupants' }, '$capacity'] },
    })
      .sort({ floor: 1, roomNumber: 1 })
      .populate('hostel');

    if (isStaff) {
      query = query.populate('occupants', 'firstName lastName email prn role');
    }

    const rooms = await query;
    const data = isStaff ? rooms : rooms.map(sanitizeRoomForStudent);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};