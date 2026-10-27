const Hostel = require('../models/Hostel');

// @desc    Get all hostels
// @route   GET /api/hostels
// @access  Public
exports.getHostels = async (req, res) => {
  try {
    const hostels = await Hostel.find();
    res.status(200).json({
      success: true,
      count: hostels.length,
      data: hostels
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single hostel
// @route   GET /api/hostels/:id
// @access  Public
exports.getHostel = async (req, res) => {
  try {
    const hostel = await Hostel.findById(req.params.id);
    
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

// @desc    Create new hostel
// @route   POST /api/hostels
// @access  Private/Admin
exports.createHostel = async (req, res) => {
  try {
    const hostel = await Hostel.create(req.body);
    
    res.status(201).json({
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

// @desc    Update hostel
// @route   PUT /api/hostels/:id
// @access  Private/Admin
exports.updateHostel = async (req, res) => {
  try {
    let hostel = await Hostel.findById(req.params.id);
    
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }
    
    hostel = await Hostel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
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

// @desc    Toggle hostel active status
// @route   PATCH /api/hostels/:id/toggle-status
// @access  Private/Admin
exports.toggleHostelStatus = async (req, res) => {
  try {
    const hostel = await Hostel.findById(req.params.id);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    hostel.isActive = !hostel.isActive;
    await hostel.save();

    res.status(200).json({
      success: true,
      message: `Hostel ${hostel.isActive ? 'activated' : 'deactivated'} successfully`,
      data: hostel,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get detailed dynamic summary of hostel (occupancy, floors, spots, full rooms)
// @route   GET /api/hostels/:id/summary
// @access  Private/Admin/Warden
exports.getHostelSummary = async (req, res) => {
  try {
    const Room = require('../models/Room');
    const hostel = await Hostel.findById(req.params.id);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    const rooms = await Room.find({ hostel: hostel._id })
      .populate('occupants', 'firstName lastName email prn role')
      .sort({ floor: 1, roomNumber: 1 });

    const totalRooms = rooms.length;
    let totalCapacity = 0;
    let totalOccupants = 0;
    const floorBreakdown = {};
    const fullRooms = [];
    const availableRooms = [];

    rooms.forEach(room => {
      const occCount = (room.occupants || []).length;
      totalCapacity += room.capacity;
      totalOccupants += occCount;

      if (!floorBreakdown[room.floor]) {
        floorBreakdown[room.floor] = {
          floor: room.floor,
          totalRooms: 0,
          totalCapacity: 0,
          totalOccupants: 0,
          rooms: []
        };
      }

      floorBreakdown[room.floor].totalRooms += 1;
      floorBreakdown[room.floor].totalCapacity += room.capacity;
      floorBreakdown[room.floor].totalOccupants += occCount;
      floorBreakdown[room.floor].rooms.push({
        _id: room._id,
        roomNumber: room.roomNumber,
        capacity: room.capacity,
        occupied: occCount,
        availableSpots: Math.max(room.capacity - occCount, 0),
        status: occCount >= room.capacity ? 'FULL' : (room.status || 'AVAILABLE'),
        occupants: room.occupants
      });

      if (occCount >= room.capacity) {
        fullRooms.push({
          _id: room._id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          capacity: room.capacity,
          occupants: room.occupants
        });
      } else {
        availableRooms.push({
          _id: room._id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          capacity: room.capacity,
          occupied: occCount,
          availableSpots: room.capacity - occCount
        });
      }
    });

    res.status(200).json({
      success: true,
      data: {
        hostel: {
          id: hostel._id,
          name: hostel.name,
          isActive: hostel.isActive,
          floors: hostel.floors,
          location: hostel.location
        },
        stats: {
          totalRooms,
          totalCapacity,
          totalOccupants,
          availableSpots: Math.max(totalCapacity - totalOccupants, 0),
          fullRoomsCount: fullRooms.length,
          availableRoomsCount: availableRooms.length,
          occupancyRate: totalCapacity > 0 ? Math.round((totalOccupants / totalCapacity) * 100) : 0
        },
        floors: Object.values(floorBreakdown),
        fullRooms,
        availableRooms
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Delete hostel (safe check: ensure no active occupants)
// @route   DELETE /api/hostels/:id
// @access  Private/Admin
exports.deleteHostel = async (req, res) => {
  try {
    const Room = require('../models/Room');
    const hostel = await Hostel.findById(req.params.id);
    
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }

    // Safety check: ensure no student occupants exist in this hostel
    const occupiedRoom = await Room.findOne({
      hostel: hostel._id,
      'occupants.0': { $exists: true }
    });

    if (occupiedRoom) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete hostel with active student occupants. Reassign students first.'
      });
    }

    // Clean up empty rooms for this hostel
    await Room.deleteMany({ hostel: hostel._id });
    await hostel.deleteOne();
    
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