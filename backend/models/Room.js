const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
    index: true
  },
  roomNumber: {
    type: String,
    required: [true, 'Please add a room number'],
    trim: true
  },
  floor: {
    type: Number,
    required: [true, 'Please add a floor number'],
    min: 0
  },
  // Legacy fields kept for backward compatibility with any pricing/UI code
  type: {
    type: String,
    enum: ['Single', 'Double', 'Triple', 'Quad', 'Dormitory'],
    default: 'Double'
  },
  capacity: {
    type: Number,
    default: 3,
    min: 1
  },
  price: {
    type: Number,
    default: 0
  },
  amenities: {
    type: [String],
    default: []
  },
  occupants: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: []
  },
  // isOccupied kept for compatibility but derived from occupants >= capacity
  isOccupied: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'FULL', 'MAINTENANCE'],
    default: 'AVAILABLE'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

RoomSchema.index({ hostel: 1, roomNumber: 1 }, { unique: true });
RoomSchema.index({ hostel: 1, floor: 1 });
RoomSchema.index({ hostel: 1, isOccupied: 1 });
RoomSchema.index({ hostel: 1, status: 1 });

RoomSchema.virtual('occupantCount').get(function () {
  return (this.occupants || []).length;
});

RoomSchema.virtual('occupied').get(function () {
  return (this.occupants || []).length;
});

RoomSchema.virtual('availableSpots').get(function () {
  const capacity = this.capacity || 0;
  return Math.max(capacity - ((this.occupants || []).length), 0);
});

RoomSchema.set('toJSON', { virtuals: true });
RoomSchema.set('toObject', { virtuals: true });

RoomSchema.pre('save', function (next) {
  if (this.occupants && this.capacity && this.occupants.length > this.capacity) {
    return next(new Error('Room capacity exceeded'));
  }
  const isFull = (this.occupants || []).length >= (this.capacity || 0);
  this.isOccupied = isFull;
  if (this.status !== 'MAINTENANCE') {
    this.status = isFull ? 'FULL' : 'AVAILABLE';
  }
  next();
});

RoomSchema.statics.recalculateOccupancy = async function (roomId) {
  const room = await this.findById(roomId);
  if (!room) return null;
  const isFull = (room.occupants || []).length >= (room.capacity || 0);
  room.isOccupied = isFull;
  if (room.status !== 'MAINTENANCE') {
    room.status = isFull ? 'FULL' : 'AVAILABLE';
  }
  return room.save();
};

module.exports = mongoose.model('Room', RoomSchema);