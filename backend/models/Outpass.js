const mongoose = require('mongoose');
const crypto = require('crypto');

const OutpassSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    hostel: {
      type: String,
      required: [true, 'Hostel is required for an outpass'],
      trim: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required for an outpass'],
      trim: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason for outpass is required'],
      trim: true,
      maxlength: [200, 'Reason cannot exceed 200 characters'],
    },
    category: {
      type: String,
      enum: ['home', 'medical', 'academic', 'emergency', 'market', 'other'],
      default: 'home',
    },
    destination: {
      type: String,
      required: [true, 'Destination address/city is required'],
      trim: true,
      maxlength: [200, 'Destination cannot exceed 200 characters'],
    },
    departureDate: {
      type: Date,
      required: [true, 'Departure date and time are required'],
    },
    expectedReturnDate: {
      type: Date,
      required: [true, 'Expected return date and time are required'],
    },
    emergencyContact: {
      type: String,
      required: [true, 'Emergency contact phone number is required'],
      trim: true,
    },
    parentContact: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'checked_out', 'returned', 'expired', 'cancelled', 'used'],
      default: 'pending',
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    adminRemarks: {
      type: String,
      trim: true,
      default: '',
      maxlength: [300, 'Admin remarks cannot exceed 300 characters'],
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedByRole: {
      type: String,
      default: '',
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedByRole: {
      type: String,
      default: '',
    },
    rejectedAt: {
      type: Date,
    },
    // Opaque, cryptographically secure pass identifier (e.g. OP-HEX)
    passCode: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
      trim: true,
    },
    // Cryptographic HMAC signature of the pass code and return date
    qrSignature: {
      type: String,
    },
    // Timestamp when student departs campus (gate check-out)
    checkedOutAt: {
      type: Date,
    },
    checkedOutBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    checkedOutByRole: {
      type: String,
      default: '',
    },
    // Backward compatibility for usedAt
    usedAt: {
      type: Date,
    },
    // Timestamp when student returns to campus (gate check-in)
    returnedAt: {
      type: Date,
    },
    returnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    returnedByRole: {
      type: String,
      default: '',
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledByRole: {
      type: String,
      default: '',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Complete audit history of outpass lifecycle events
    auditLog: [
      {
        event: {
          type: String,
          required: true,
          enum: [
            'REQUESTED',
            'APPROVED',
            'REJECTED',
            'QR_GENERATED',
            'VERIFIED',
            'CHECKED_OUT',
            'RETURNED',
            'CANCELLED',
            'REUSE_ATTEMPTED',
            'EXPIRED_SCAN',
          ],
        },
        actor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        actorRole: {
          type: String,
          default: '',
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        notes: {
          type: String,
          default: '',
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

OutpassSchema.virtual('isOverdue').get(function () {
  if (this.status === 'checked_out' || this.status === 'used') {
    return new Date() > new Date(this.expectedReturnDate);
  }
  return false;
});

// Compound indexes for rapid query execution
OutpassSchema.index({ student: 1, createdAt: -1 });
OutpassSchema.index({ status: 1, createdAt: -1 });
OutpassSchema.index({ hostel: 1, departureDate: -1 });

// Static helper to generate a cryptographically secure, opaque passCode
OutpassSchema.statics.generatePassCode = function () {
  const randomHex = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `OP-${randomHex}`;
};

// Method to generate HMAC-SHA256 signature for the pass
OutpassSchema.methods.signPass = function (secret) {
  const secretKey = secret || process.env.JWT_SECRET || 'hms_pass_signature_secret_key_default';
  const studentId = this.student?._id ? this.student._id.toString() : (this.student ? this.student.toString() : '');
  const returnTime = this.expectedReturnDate ? new Date(this.expectedReturnDate).getTime() : 0;
  const dataToSign = `${this.passCode}:${returnTime}:${studentId}`;
  return crypto.createHmac('sha256', secretKey).update(dataToSign).digest('hex');
};

module.exports = mongoose.model('Outpass', OutpassSchema);
