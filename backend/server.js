// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables FIRST
dotenv.config();

// Import database connection and room initializer
const connectDB = require('./config/database');
const { initializeHostelRooms } = require('./config/roomInitializer');

// Import route files
const userRoutes = require('./routes/userRoutes');
const hostelRoutes = require('./routes/hostelRoutes');
const roomRoutes = require('./routes/roomRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const messMenuRoutes = require('./routes/messMenuRoutes');
const busRouteRoutes = require('./routes/busRouteRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const profileRoutes = require('./routes/profileRoutes');
const outpassRoutes = require('./routes/outpassRoutes');
const wardenRoutes = require('./routes/wardenRoutes');
const securityRoutes = require('./routes/securityRoutes');

// Middleware
const errorHandler = require('./middleware/errorHandler');
const mongoSanitize = require('./middleware/sanitize');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const subDirs = ['mess-menu', 'profile-images', 'bus-routes', 'notices'];
for (const sub of subDirs) {
  fs.mkdirSync(path.join(uploadsDir, sub), { recursive: true });
}

// 1. Security Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows frontend to render uploaded images
    contentSecurityPolicy: false,
  })
);

// 2. CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:8080',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Body parsers with safe size limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 4. NoSQL Injection Sanitization
app.use(mongoSanitize);

// 4.1 Parse cookies
app.use(cookieParser());

// 4.2 Health check routes (Exempt from rate limits for container & load-balancer probes)
app.get(['/api/health', '/health'], (_req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'API is running in production-ready mode',
    mongodb: 'connected',
    timestamp: new Date().toISOString(),
  });
});

// 5. Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40, // 40 requests per 15 minutes for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
});

// Apply rate limits
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/users/forgot-password', authLimiter);
app.use('/api/users/reset-password', authLimiter);
app.use('/api/users/resend-verification', authLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/admin/forgot-password', authLimiter);
app.use('/api/admin/reset-password', authLimiter);
app.use('/api', generalApiLimiter);

// 6. Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// 7. Mount API Routes (Synchronously so they are always active)
app.use('/api/users', userRoutes);
app.use('/api/hostels', hostelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/mess-menu', messMenuRoutes);
app.use('/api/bus-routes', busRouteRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/outpass', outpassRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/warden', wardenRoutes);

// Catch-all 404 handler for undefined API endpoints
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Centralized error handler
app.use(errorHandler);

let serverInstance = null;

// Start server function
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Ensure initial hostels and rooms exist
    await initializeHostelRooms();

    // Listen on PORT
    serverInstance = app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📍 API URL: http://localhost:${PORT}/api`);
      console.log(`🛡️  Security headers, rate limiting & NoSQL sanitization active`);
      console.log(`✅ MongoDB is connected and ready\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('HTTP server closed.');
      const mongoose = require('mongoose');
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed.');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// If executed directly (not required as module)
if (require.main === module) {
  startServer();
}

module.exports = app;
