const mongoose = require('mongoose');

const busRouteSchema = new mongoose.Schema({
  routeName: {
    type: String,
    required: [true, 'Route name is required'],
    trim: true
  },
  stops: [{
    type: String,
    required: true
  }],
  timings: [{
    type: String,
    required: true
  }],
  imageUrl: {
    type: String,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BusRoute', busRouteSchema);
