const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please add a complaint title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Please select a category'],
    enum: [
      'technical', 'maintenance', 'electrical', 'electrician',
      'plumbing', 'plumber', 'food', 'mess',
      'cleaning', 'housekeeping', 'security', 'it', 'internet', 'other'
    ]
  },
  hostel: {
    type: String,
    required: [true, 'Please specify hostel']
  },
  floor: {
    type: String,
    required: [true, 'Please specify floor']
  },
  roomNumber: {
    type: String,
    required: [true, 'Please specify room number']
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'rejected'],
    default: 'pending'
  },
  assignedDepartment: {
    type: String,
    enum: [
      'electrician', 'electrical',
      'plumber', 'plumbing',
      'housekeeping', 'cleaning',
      'maintenance',
      'it', 'security', 'mess', 'none'
    ],
    default: 'none'
  },
  updatedByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminNotes: {
    type: String,
    maxlength: [300, 'Admin notes cannot be more than 300 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for 1,000+ students and historical operational records
ComplaintSchema.index({ user: 1, createdAt: -1 });
ComplaintSchema.index({ status: 1, createdAt: -1 });
ComplaintSchema.index({ hostel: 1, roomNumber: 1 });

// Update the updatedAt field before saving
ComplaintSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Complaint', ComplaintSchema);

