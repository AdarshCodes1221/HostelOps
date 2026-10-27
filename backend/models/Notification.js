const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  recipientRole: {
    type: String,
    enum: ['admin', 'warden', 'student', 'security', 'super_admin', 'all', null],
    default: null,
  },
  recipientRoles: [{
    type: String,
    enum: ['admin', 'warden', 'student', 'security', 'super_admin', 'all'],
  }],
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  entityType: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
  },
  type: {
    type: String,
    enum: [
      'registration',
      'approval',
      'allocation',
      'complaint',
      'complaint_escalation',
      'room_change_request',
      'booking',
      'mess-menu',
      'bus-route',
      'maintenance',
      'system',
      'general',
      'outpass',
      'outpass_request',
      'outpass_approved',
      'notice',
      'announcement',
      'room_allocation',
    ],
    default: 'general',
  },
  actionUrl: {
    type: String,
    default: null,
  },
  hostel: {
    type: String,
    default: null,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    default: null,
  },
  roomNumber: {
    type: String,
    default: null,
  },
  read: {
    type: Boolean,
    default: false,
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for fast retrieval
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, createdAt: -1 });
notificationSchema.index({ recipientRoles: 1, createdAt: -1 });
notificationSchema.index({ hostel: 1, recipientRole: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
