/**
 * MongoDB Connection Module
 * Handles connection to MongoDB with proper error handling
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const mongoURI = process.env.MONGO_URI;

    console.log('🔄 Connecting to MongoDB...');
    console.log('   URI:', mongoURI ? mongoURI.replace(/:([^@]+)@/, ':****@') : 'undefined');

    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      maxPoolSize: 50, // Connection pool scaled for ~1,000 students
      minPoolSize: 5,
    });

    console.log('✅ MongoDB Connected Successfully!');
    console.log('   Host:', conn.connection.host);
    console.log('   Database:', conn.connection.name);

    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Failed!');
    console.error('   Error:', error.message);
    console.error('\n📋 Troubleshooting:');
    console.error('   1. Is MongoDB running?');
    console.error('   2. Check MONGO_URI in .env file');
    console.error('   3. Check IP Whitelist on MongoDB Atlas\n');

    process.exit(1);
  }
};

module.exports = connectDB;
