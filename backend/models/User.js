const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Please add first name'],
    trim: true,
    maxlength: [50, 'First name cannot be more than 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Please add last name'],
    trim: true,
    maxlength: [50, 'Last name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  prn: {
    type: String,
    sparse: true,
    unique: true,
    trim: true,
    index: true
  },
  profileImage: {
    type: String,
    default: ''
  },
  designation: {
    type: String,
    trim: true,
    default: ''
  },
  emergencyContact: {
    type: String,
    trim: true,
    default: ''
  },
  role: {
    type: String,
    enum: ['student', 'warden', 'admin', 'security', 'super_admin'],
    default: 'student',
    index: true
  },
  hostel: {
    type: String,
    trim: true,
    sparse: true,
    validate: {
      validator: function(v) {
        // If role is warden, hostel is required
        if (this.role === 'warden') {
          return v && v.length > 0;
        }
        // For other roles, hostel is optional
        return true;
      },
      message: 'Hostel is required for warden role'
    }
  },
  roomNumber: {
    type: String,
    trim: true,
    sparse: true
  },
  roomLocked: {
    type: Boolean,
    default: false
  },
  requestedRoom: {
    type: String,
    trim: true,
    sparse: true
  },
  roomChangeRequested: {
    type: Boolean,
    default: false
  },
  phone: {
    type: String,
    trim: true,
    sparse: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  rejectionReason: {
    type: String,
    trim: true,
    default: ''
  },
  floor: {
    type: String,
    trim: true,
    sparse: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  emailVerificationToken: {
    type: String,
    select: false,
    index: true
  },
  emailVerificationExpire: {
    type: Date,
    select: false
  },
  emailVerificationResendCount: {
    type: Number,
    default: 0,
    select: false
  },
  emailVerificationLastResend: {
    type: Date,
    select: false
  },
  emailOtp: {
    type: String,
    select: false
  },
  emailOtpExpire: {
    type: Date,
    select: false
  },
  emailOtpAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  resetPasswordToken: {
    type: String,
    select: false,
    index: true
  },
  resetPasswordExpire: {
    type: Date,
    select: false
  },
  recoveryEmail: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
    index: true
  },
  isRecoveryEmailVerified: {
    type: Boolean,
    default: false
  },
  recoveryEmailVerificationToken: {
    type: String,
    select: false
  },
  recoveryEmailVerificationExpire: {
    type: Date,
    select: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for query performance with ~1,000 students
UserSchema.index({ hostel: 1, roomNumber: 1 });
UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ status: 1, createdAt: -1 });

// Sign JWT and return with role
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash 6-digit numeric OTP for email verification (10 minutes expiry)
UserSchema.methods.generateEmailOtp = function() {
  const digits = '0123456789';
  let rawOtp = '';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    rawOtp += digits[randomBytes[i] % 10];
  }
  this.emailOtp = crypto.createHash('sha256').update(rawOtp).digest('hex');
  this.emailOtpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  this.emailOtpAttempts = 0;
  return rawOtp;
};

// Generate and hash cryptographic email verification token
UserSchema.methods.generateEmailVerificationToken = function() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return rawToken;
};

// Generate and hash cryptographic password reset token
UserSchema.methods.generatePasswordResetToken = function() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
  return rawToken;
};

module.exports = mongoose.model('User', UserSchema);