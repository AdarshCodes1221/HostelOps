const mongoose = require('mongoose');

const messMenuSchema = new mongoose.Schema({
  day: {
    type: String,
    required: [true, 'Day is required'],
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'weekly'],
    lowercase: true
  },
  mealType: {
    type: String,
    required: [true, 'Meal type is required'],
    enum: ['breakfast', 'lunch', 'snacks', 'dinner', 'all'],
    lowercase: true
  },
  items: [{
    type: String,
    default: []
  }],
  imageUrl: {
    type: String,
    default: null
  },
  weekStartDate: {
    type: String,
    default: ''
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index to ensure one menu per day per meal type
messMenuSchema.index({ day: 1, mealType: 1 }, { unique: true });

module.exports = mongoose.model('MessMenu', messMenuSchema);
