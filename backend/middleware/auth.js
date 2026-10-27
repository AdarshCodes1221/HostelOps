const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes: requires a valid JWT token in Authorization header
 */
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && (req.cookies.token || req.cookies.accessToken)) {
    token = req.cookies.token || req.cookies.accessToken;
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route. Missing token.',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists',
      });
    }

    // Students must have verified email if required
    if (user.role === 'student' && process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your email address is not verified. Please verify your email before accessing the portal.',
      });
    }

    // Students must have approved status to access protected routes
    if (user.role === 'student' && user.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: user.status === 'rejected'
          ? 'Your account registration was rejected. Please contact the warden office.'
          : 'Your account is pending review and room allocation by hostel administration.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    let message = 'Not authorized to access this route';
    if (err.name === 'TokenExpiredError') {
      message = 'Session expired. Please log in again.';
    } else if (err.name === 'JsonWebTokenError') {
      message = 'Invalid authentication token';
    }

    return res.status(401).json({
      success: false,
      message,
    });
  }
};

/**
 * Optional authentication middleware:
 * Populates req.user if valid token provided, but doesn't block unauthenticated requests.
 */
exports.optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user) {
      req.user = user;
    }
  } catch (err) {
    // Silently continue for optional auth
  }

  next();
};

/**
 * Role-based authorization middleware:
 * Ensures req.user has one of the specified roles
 * Super admin can access all roles
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: 'User not authorized',
      });
    }
    // Super admin has access to all roles
    if (req.user.role === 'super_admin') {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

// Hostel scoping middleware for wardens
// Ensures wardens can only access resources in their assigned hostel(s)
exports.hostelScope = () => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: 'User not authorized',
      });
    }

    // Only apply hostel scoping to wardens
    if (req.user.role !== 'warden') {
      return next();
    }

    // For wardens, validate that they have an assigned hostel
    if (!req.user.hostel) {
      return res.status(403).json({
        success: false,
        message: 'Warden not assigned to any hostel',
      });
    }

    // Attach hostel information to request for use in controllers
    req.wardenHostel = req.user.hostel;
    next();
  };
};

// Middleware to prevent admins from performing gate operations (security functions)
exports.preventGateOperations = () => {
  return (req, res, next) => {
    // Prevent admins from accessing security gate functions
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      // Check if the request is for gate operations
      const gateOperations = ['/checkout', '/return', '/verify-qr'];
      const isGateOperation = gateOperations.some(op =>
        req.path.includes(op) ||
        (req.params.id && req.path.includes(`/outpass/admin/${req.params.id}/mark-used`))
      );

      if (isGateOperation) {
        return res.status(403).json({
          success: false,
          message: 'Admins and Super Admins cannot perform gate operations',
        });
      }
    }
    next();
  };
};