const User = require('../models/User');
const Room = require('../models/Room');
const Hostel = require('../models/Hostel');
const Booking = require('../models/Booking');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendVerificationEmail, sendEmail } = require('../services/emailService');
const { notifyAdmins, notifyUser } = require('../services/notificationService');
const { setAuthCookie, clearAuthCookie } = require('../utils/authCookies');

const buildProfileResponse = (user) => {
  const profile = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    recoveryEmail: user.recoveryEmail || '',
    isRecoveryEmailVerified: user.isRecoveryEmailVerified || false,
    phone: user.phone || '',
    role: user.role,
    profileImage: user.profileImage || '',
    designation: user.designation || '',
    emergencyContact: user.emergencyContact || '',
    hostel: user.hostel || '',
    status: user.status || 'pending',
    rejectionReason: user.rejectionReason || '',
  };

  if (user.role === 'student') {
    profile.prn = user.prn || '';
    profile.floor = user.floor || '';
    profile.roomNumber = user.roomNumber || '';
    profile.roomLocked = user.roomLocked || false;
    profile.roomChangeRequested = user.roomChangeRequested || false;
    profile.requestedRoom = user.requestedRoom || '';
  }

  return profile;
};

// Generate JWT Token with role
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

// Validation functions
const COLLEGE_EMAIL_DOMAIN = '@sitpune.edu.in';

// Strict regex for SIT Pune college emails:
// - Local part: alphanumeric characters, dots, hyphens, underscores, %, +
// - No consecutive dots, no leading/trailing dots/hyphens
// - Domain: exactly sitpune.edu.in
const SIT_PUNE_EMAIL_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@sitpune\.edu\.in$/;

// General email regex for admins/wardens
const GENERAL_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const validateStudentEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Please provide an email address' };
  }

  const normalized = email.trim().toLowerCase();

  // Reject multiple @ symbols
  if ((normalized.match(/@/g) || []).length !== 1) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Must end with @sitpune.edu.in
  if (!normalized.endsWith(COLLEGE_EMAIL_DOMAIN)) {
    return { valid: false, error: 'Only official SIT Pune college email IDs are allowed (must end with @sitpune.edu.in)' };
  }

  // Strict format validation enforcing the exact college domain
  if (!SIT_PUNE_EMAIL_REGEX.test(normalized)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, email: normalized };
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&* etc.)');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true };
};

const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }
  const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
  if (!/^[0-9]{10}$/.test(cleanPhone)) {
    return { valid: false, error: 'Please enter a valid 10-digit phone number' };
  }
  return { valid: true, phone: cleanPhone };
};

// @desc    Register new student (Public endpoint — strictly for students)
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, prn, phone } = req.body;

    // Check required fields
    if (!firstName || !lastName || !email || !password || !prn || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: first name, last name, PRN, email, phone, and password',
      });
    }

    // Validate email strictly for college domain
    const emailValidation = validateStudentEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ success: false, message: emailValidation.error });
    }
    const cleanEmail = emailValidation.email;

    // Validate phone number
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ success: false, message: phoneValidation.error });
    }
    const cleanPhone = phoneValidation.phone;

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password does not meet strength requirements',
        errors: passwordValidation.errors,
      });
    }

    // Check if email already registered
    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    // Check if PRN already registered
    const prnExists = await User.findOne({ prn: prn.trim() });
    if (prnExists) {
      return res.status(400).json({ success: false, message: 'An account with this PRN is already registered' });
    }

    // Check if phone number already registered
    const phoneExists = await User.findOne({ phone: cleanPhone });
    if (phoneExists) {
      return res.status(400).json({ success: false, message: 'An account with this phone number already exists' });
    }

    // Hash password with bcrypt (12 rounds)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create student account with 'pending' status — room allocation handled exclusively by admin/warden
    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: cleanEmail,
      password: hashedPassword,
      prn: prn.trim(),
      phone: cleanPhone,
      role: 'student',
      status: 'pending',
      isEmailVerified: false,
      roomLocked: false,
      hostel: '',
      floor: '',
      roomNumber: '',
    });

    // Generate cryptographic verification token and numeric OTP
    const verificationToken = user.generateEmailVerificationToken();
    const otp = user.generateEmailOtp();
    await user.save({ validateBeforeSave: false });

    // Send verification email with OTP via Brevo SMTP
    try {
      await sendVerificationEmail({
        to: user.email,
        firstName: user.firstName,
        verificationToken,
        otp,
      });
    } catch (mailErr) {
      console.warn('⚠️ Verification email dispatch failed:', mailErr.message);
    }

    // Notify administrators of pending registration
    await notifyAdmins({
      title: 'New Student Registration',
      message: `${user.firstName} ${user.lastName} (PRN: ${user.prn}) registered and awaits review.`,
      type: 'registration',
      entityId: user._id,
      entityType: 'User',
    });

    const responseData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      prn: user.prn,
      phone: user.phone,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
    };

    // Include verificationToken in response for dev/test execution
    if (process.env.NODE_ENV !== 'production') {
      responseData.verificationToken = verificationToken;
    }

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Please verify your college email address before logging in.',
      data: responseData,
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `An account with this ${field} already exists`,
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Server error during registration' });
  }
};

// @desc    Authenticate user & get token (Students only)
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input fields (strictly reject non-string injection objects)
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password as valid strings',
      });
    }

    const cleanIdentifier = email.trim().toLowerCase();

    // Check for user by email or PRN, explicitly selecting the password hash
    const user = await User.findOne({
      $or: [
        { email: cleanIdentifier },
        { prn: email.trim() },
      ]
    }).select('+password');

    // Generic error message to prevent user enumeration
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials',
      });
    }

    // Disallow admins and wardens from logging in via the student portal
    if (user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Admins and wardens must sign in via the Admin Portal.',
      });
    }

    // Compare password using bcrypt
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials',
      });
    }

    // Check if email verification is required and student has not verified
    if (user.role === 'student' && !user.isEmailVerified && process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
      return res.status(403).json({
        success: false,
        message: 'Please verify your college email address before logging in. Check your inbox for the verification link.',
        needsEmailVerification: true,
      });
    }

    // Check student account approval status
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending review and room allocation by hostel administration. Please wait for an administrator to approve your account.',
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: user.rejectionReason
          ? `Your account registration was rejected: ${user.rejectionReason}. Please contact the warden office.`
          : 'Your account registration was rejected. Please contact the warden office.',
      });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your account is not approved for login.',
      });
    }

    // Generate JWT token with user id and role
    const token = generateToken(user);

    // Set secure HttpOnly session cookie
    setAuthCookie(res, token);

    // Success: return user data (without password) and token
    res.json({
      success: true,
      data: {
        ...buildProfileResponse(user),
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login. Please try again later.',
    });
  }
};

// @desc    Get user profile (Derived from authenticated token context)
// @route   GET /api/users/profile, GET /api/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: buildProfileResponse(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile (Self-update only, no IDOR)
// @route   PUT /api/users/profile, PUT /api/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Whitelist mutable fields (prevent role tampering)
    if (req.body.firstName !== undefined) user.firstName = req.body.firstName.trim();
    if (req.body.lastName !== undefined) user.lastName = req.body.lastName.trim();
    if (req.body.phone !== undefined) user.phone = req.body.phone.trim();
    if (req.body.designation !== undefined) user.designation = req.body.designation.trim();
    if (req.body.emergencyContact !== undefined) user.emergencyContact = req.body.emergencyContact.trim();

    // Students cannot freely switch hostel/floor/room without admin approval
    if (user.role === 'student') {
      if (req.body.roomNumber !== undefined && req.body.roomNumber !== user.roomNumber) {
        if (user.roomLocked) {
          user.requestedRoom = req.body.roomNumber.toString().trim();
          user.roomChangeRequested = true;
          await notifyAdmins({
            title: 'Room Change Request',
            message: `${user.firstName} ${user.lastName} (PRN: ${user.prn || 'N/A'}) requested room change to Room ${user.requestedRoom}.`,
            type: 'room_change_request',
            entityId: user._id,
            entityType: 'User',
            hostel: user.hostel,
            roomNumber: user.roomNumber,
            recipientRoles: ['admin', 'warden', 'super_admin'],
          });
        } else {
          user.roomNumber = req.body.roomNumber.toString().trim();
        }
      }
    } else {
      // Admin/warden updates
      if (req.body.hostel !== undefined) user.hostel = req.body.hostel;
    }

    // If updating password
    if (req.body.password) {
      const passwordValidation = validatePassword(req.body.password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet strength requirements',
          errors: passwordValidation.errors,
        });
      }
      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await user.save();

    res.json({
      success: true,
      data: {
        ...buildProfileResponse(updatedUser),
        token: generateToken(updatedUser),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload profile image
// @route   POST /api/profile/upload-image
// @access  Private
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a valid image file' });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.profileImage = `/uploads/profile-images/${req.file.filename}`;
    await user.save();

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        ...buildProfileResponse(user),
        token: generateToken(user),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Request a password-reset link (Generic response prevents user enumeration)
// @route   POST /api/users/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !GENERAL_EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }


    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      role: 'student',
      $or: [
        { email: cleanEmail },
        { recoveryEmail: cleanEmail, isRecoveryEmailVerified: true }
      ]
    });

    // Standard generic response whether email exists or not
    const genericResponse = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent to your email.',
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Generate 32-byte cryptographically secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    // Store only SHA-256 hash of the token in the database
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Token expires in 15 minutes
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    // Send reset email via emailService
    try {
      await sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        resetToken,
      });

      // If student has a verified recovery email, also deliver to recovery email
      if (user.recoveryEmail && user.isRecoveryEmailVerified && user.recoveryEmail !== user.email) {
        try {
          await sendPasswordResetEmail({
            to: user.recoveryEmail,
            firstName: user.firstName,
            resetToken,
          });
        } catch (recErr) {
          console.warn('Could not dispatch reset email to student recovery address:', recErr.message);
        }
      }
    } catch (mailErr) {
      console.error('Failed to send reset email:', mailErr.message);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ success: false, message: 'Could not send reset email. Please try again later.' });
    }

    // In non-production testing, return resetToken for automated tests
    const responsePayload = { ...genericResponse };
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.resetToken = resetToken;
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error during password reset request' });
  }
};

// @desc    Reset password using token from email link (Students only)
// @route   POST /api/users/reset-password/:token, POST /api/users/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const rawToken = req.params.token || (req.body && req.body.token);
    const password = req.body && req.body.password;

    if (!rawToken || typeof rawToken !== 'string' || !/^[0-9a-f]{64}$/i.test(rawToken.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or malformed password reset token.',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a new password as a valid string.',
      });
    }

    // Hash token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpire: { $gt: Date.now() },
      role: 'student',
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new reset link.',
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet strength requirements',
        errors: passwordValidation.errors,
      });
    }

    // Hash new password with 12 salt rounds
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(password, salt);

    // Invalidate reset token immediately to prevent reuse
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Log the user in with a fresh JWT
    res.status(200).json({
      success: true,
      message: 'Password reset successful. You are now logged in.',
      data: {
        ...buildProfileResponse(user),
        token: generateToken(user),
      },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error during password reset' });
  }
};

// @desc    Verify student email using token or 6-digit OTP
// @route   GET /api/users/verify-email/:token, POST /api/users/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const rawInput = (req.params.token || req.body.token || req.body.otp || req.query.token || req.query.otp || '').toString().trim();
    const email = (req.body.email || req.query.email || '').toString().trim().toLowerCase();

    if (!rawInput) {
      return res.status(400).json({
        success: false,
        message: 'Verification code or token is required.',
      });
    }

    const hashedInput = crypto.createHash('sha256').update(rawInput).digest('hex');
    const isNumericOtp = /^\d{6}$/.test(rawInput);

    let user;

    if (isNumericOtp) {
      // 6-digit OTP verification
      const query = email ? { email, role: 'student' } : { emailOtp: hashedInput };
      user = await User.findOne(query).select('+emailOtp +emailOtpExpire +emailOtpAttempts');

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code. Please check and try again.',
        });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: 'This email address has already been verified.',
        });
      }

      // Check max attempt limits (5 attempts)
      if (user.emailOtpAttempts >= 5) {
        return res.status(429).json({
          success: false,
          message: 'Too many incorrect attempts. This OTP has been invalidated. Please request a new verification code.',
        });
      }

      // Check expiry
      if (!user.emailOtpExpire || user.emailOtpExpire < Date.now()) {
        return res.status(400).json({
          success: false,
          message: 'Verification code has expired. Please request a new code.',
        });
      }

      // Validate OTP hash
      if (user.emailOtp !== hashedInput) {
        user.emailOtpAttempts = (user.emailOtpAttempts || 0) + 1;
        await user.save({ validateBeforeSave: false });
        const remaining = 5 - user.emailOtpAttempts;
        return res.status(400).json({
          success: false,
          message: remaining > 0 
            ? `Invalid verification code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
            : 'Too many incorrect attempts. This OTP has been invalidated. Please request a new verification code.',
        });
      }
    } else {
      // 64-char hex token verification
      user = await User.findOne({
        emailVerificationToken: hashedInput,
        emailVerificationExpire: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token. Please request a new verification email.',
        });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: 'This email address has already been verified.',
        });
      }
    }

    // Activate and verify account
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    user.emailOtp = undefined;
    user.emailOtpExpire = undefined;
    user.emailOtpAttempts = 0;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Email address verified successfully. Your account is now active and in queue for hostel room allocation.',
      data: {
        email: user.email,
        isEmailVerified: true,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, message: 'Server error during email verification' });
  }
};

// @desc    Resend verification email and OTP to student
// @route   POST /api/users/resend-verification
// @access  Public
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail, role: 'student' }).select(
      '+emailVerificationLastResend +emailVerificationResendCount +emailOtpAttempts'
    );

    // Generic response if account doesn't exist (prevent account enumeration)
    const genericResponse = {
      success: true,
      message: 'If your account is registered and pending email verification, a new verification code has been sent.',
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'This email address is already verified.',
      });
    }

    // Rate-limiting check: enforce minimum 60s cooldown
    if (user.emailVerificationLastResend) {
      const elapsed = Date.now() - new Date(user.emailVerificationLastResend).getTime();
      if (elapsed < 60 * 1000) {
        const remainingSec = Math.ceil((60 * 1000 - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingSec} seconds before requesting another verification code.`,
        });
      }
    }

    // Generate new verification token and new OTP (invalidating old ones)
    const verificationToken = user.generateEmailVerificationToken();
    const otp = user.generateEmailOtp();
    user.emailVerificationLastResend = new Date();
    user.emailVerificationResendCount = (user.emailVerificationResendCount || 0) + 1;
    await user.save({ validateBeforeSave: false });

    try {
      await sendVerificationEmail({
        to: user.email,
        firstName: user.firstName,
        verificationToken,
        otp,
      });
    } catch (mailErr) {
      console.warn('⚠️ Verification email dispatch failed:', mailErr.message);
    }

    const responsePayload = { ...genericResponse };
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.verificationToken = verificationToken;
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, message: 'Server error during verification resend request' });
  }
};

// @desc    Logout student & clear cookie
// @route   POST /api/users/logout
// @access  Public
const logoutUser = async (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({
    success: true,
    message: 'User logged out successfully',
  });
};

// @desc    Request verification code for personal recovery email
// @route   POST /api/users/recovery-email
// @access  Private (Authenticated)
const requestRecoveryEmail = async (req, res) => {
  try {
    const { recoveryEmail } = req.body;
    if (!recoveryEmail || typeof recoveryEmail !== 'string' || !GENERAL_EMAIL_REGEX.test(recoveryEmail.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid recovery email address' });
    }

    const cleanRecoveryEmail = recoveryEmail.trim().toLowerCase();
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate 6-digit OTP
    const recoveryOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(recoveryOtp).digest('hex');

    user.recoveryEmail = cleanRecoveryEmail;
    user.isRecoveryEmailVerified = false;
    user.recoveryEmailVerificationToken = otpHash;
    user.recoveryEmailVerificationExpire = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    // Send verification code to the recovery email
    try {
      await sendEmail({
        to: cleanRecoveryEmail,
        subject: `Your Recovery Email Verification OTP is ${recoveryOtp} — Symbiosis HMS`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 20px auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e293b; margin-top: 0;">Verify Personal Recovery Email</h2>
            <p>Hello <strong>${user.firstName}</strong>,</p>
            <p>You requested to bind this personal recovery email to your Symbiosis HMS account (<strong>${user.email}</strong>).</p>
            <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #2563eb;">${recoveryOtp}</span>
            </div>
            <p style="color: #64748b; font-size: 13px;">This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error('Error sending recovery verification email:', mailErr.message);
      return res.status(500).json({ success: false, message: 'Could not send verification email to recovery address' });
    }

    const responsePayload = {
      success: true,
      message: 'Verification OTP dispatched to your personal recovery email address.',
    };
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.recoveryOtp = recoveryOtp;
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Request recovery email error:', error);
    res.status(500).json({ success: false, message: 'Server error requesting recovery email' });
  }
};

// @desc    Verify personal recovery email OTP
// @route   POST /api/users/verify-recovery-email
// @access  Private
const verifyRecoveryEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp || typeof otp !== 'string') {
      return res.status(400).json({ success: false, message: 'Verification OTP is required' });
    }

    const otpHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    const user = await User.findById(req.user.id).select('+recoveryEmailVerificationToken +recoveryEmailVerificationExpire');

    if (!user || user.recoveryEmailVerificationToken !== otpHash || !user.recoveryEmailVerificationExpire || user.recoveryEmailVerificationExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired recovery verification code' });
    }

    user.isRecoveryEmailVerified = true;
    user.recoveryEmailVerificationToken = undefined;
    user.recoveryEmailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Personal recovery email verified successfully. It will now receive password reset links if you lose access to your primary email.',
      data: {
        recoveryEmail: user.recoveryEmail,
        isRecoveryEmailVerified: true,
      },
    });
  } catch (error) {
    console.error('Verify recovery email error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying recovery email' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  uploadProfileImage,
  requestRecoveryEmail,
  verifyRecoveryEmail,
};