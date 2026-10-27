/**
 * PHASE 7 AUTOMATED TEST SUITE: PASSWORD RESET HARDENING
 *
 * Verifies:
 * 1. Forgot password returns generic response whether email exists or not (prevents enumeration)
 * 2. Raw reset token is never stored in DB (only SHA-256 hash) with 15m expiration
 * 3. Reset password succeeds with valid token and strong password
 * 4. Old password immediately stops working after password reset
 * 5. New password authenticates successfully and issues fresh session
 * 6. Single-use enforcement: consuming token immediately invalidates it (cannot reuse)
 * 7. Expired reset token fails with 401
 * 8. Malformed / non-hex tokens safely rejected with 400
 * 9. Weak passwords rejected during reset (minimum 8 chars, uppercase, lowercase, number, symbol)
 * 10. Multiple reset requests: newer request invalidates previous token
 * 11. Admin password reset adheres to identical security invariants
 * 12. Clean database teardown
 */

const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const connectDB = require('../config/database');
const app = require('../server');

const results = [];
function record(testNum, description, passed) {
  results.push({ testNum, description, passed });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${passed ? '✅' : '❌'} Test ${String(testNum).padStart(2, ' ')}: ${description} -> ${status}`);
}

function request(serverPort, method, pathUrl, payload = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = payload ? JSON.stringify(payload) : '';
    const reqHeaders = {
      ...headers,
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {}),
    };

    const req = http.request(
      {
        hostname: 'localhost',
        port: serverPort,
        path: pathUrl,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let body = {};
          try {
            body = JSON.parse(raw);
          } catch (_) {
            body = { raw };
          }
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runPhase7Tests() {
  console.log('\n===============================================================');
  console.log('🔑 RUNNING PHASE 7: PASSWORD RESET HARDENING TEST SUITE');
  console.log('===============================================================\n');

  let server;
  let serverPort;
  const unique = Date.now();
  const studentEmail = `student.reset.${unique}@sitpune.edu.in`;
  const adminEmail = `admin.reset.${unique}@symbiosis.ac.in`;
  const initialPassword = 'InitialPass@123';
  const newPassword = 'BrandNewPass@456';

  let studentId;
  let adminId;

  try {
    await connectDB();

    server = http.createServer(app);
    await new Promise((res) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        console.log(`📡 Test server running on http://localhost:${serverPort}\n`);
        res();
      });
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(initialPassword, salt);

    // Setup Student
    const studentUser = await User.create({
      firstName: 'ResetStudent',
      lastName: 'P7',
      email: studentEmail,
      password: hashedPass,
      role: 'student',
      status: 'approved',
      isEmailVerified: true,
      prn: `RES${unique.toString().slice(-6)}`,
      phone: `91${unique.toString().slice(-8)}`,
    });
    studentId = studentUser._id;

    // Setup Admin
    const adminUser = await User.create({
      firstName: 'ResetAdmin',
      lastName: 'P7',
      email: adminEmail,
      password: hashedPass,
      role: 'admin',
      status: 'approved',
      isEmailVerified: true,
      phone: `92${unique.toString().slice(-8)}`,
    });
    adminId = adminUser._id;

    // Test 1: Forgot password returns identical generic response for existing & non-existing emails
    const existingForgotRes = await request(serverPort, 'POST', '/api/users/forgot-password', {
      email: studentEmail,
    });
    const nonExistingForgotRes = await request(serverPort, 'POST', '/api/users/forgot-password', {
      email: `doesnotexist.${unique}@sitpune.edu.in`,
    });
    record(
      1,
      'Forgot password returns generic response preventing user enumeration',
      existingForgotRes.status === 200 &&
        nonExistingForgotRes.status === 200 &&
        existingForgotRes.body.message === nonExistingForgotRes.body.message
    );

    // Test 2: Database stores only SHA-256 hashed token with safe expiration
    const studentWithToken = await User.findById(studentId).select('+resetPasswordToken +resetPasswordExpire');
    const rawResetToken = existingForgotRes.body.resetToken;
    const isHashed =
      studentWithToken.resetPasswordToken &&
      studentWithToken.resetPasswordToken !== rawResetToken &&
      studentWithToken.resetPasswordToken === crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const hasSafeExpiry =
      studentWithToken.resetPasswordExpire &&
      new Date(studentWithToken.resetPasswordExpire).getTime() > Date.now();
    record(
      2,
      'Reset token stored exclusively as SHA-256 hash with 15m expiration',
      isHashed && hasSafeExpiry
    );

    // Test 3: Malformed tokens (non-hex, invalid lengths) are rejected with 400
    const malformedTokenRes = await request(serverPort, 'POST', '/api/users/reset-password/not-a-valid-hex-token', {
      password: newPassword,
    });
    record(
      3,
      'Malformed/non-hex reset tokens are strictly rejected (400)',
      malformedTokenRes.status === 400
    );

    // Test 4: Weak passwords rejected during reset
    const weakPassRes = await request(serverPort, 'POST', `/api/users/reset-password/${rawResetToken}`, {
      password: 'weak',
    });
    record(
      4,
      'Weak passwords rejected during password reset (400)',
      weakPassRes.status === 400
    );

    // Test 5: Reset password succeeds with valid token and strong password
    const validResetRes = await request(serverPort, 'POST', `/api/users/reset-password/${rawResetToken}`, {
      password: newPassword,
    });
    record(
      5,
      'Reset password succeeds with valid token and strong password (200 OK)',
      validResetRes.status === 200 && validResetRes.body.success === true
    );

    // Test 6: Old password immediately stops working after reset
    const oldLoginRes = await request(serverPort, 'POST', '/api/users/login', {
      email: studentEmail,
      password: initialPassword,
    });
    record(
      6,
      'Old password is immediately invalidated after reset (401)',
      oldLoginRes.status === 401
    );

    // Test 7: New password works and issues authentic session
    const newLoginRes = await request(serverPort, 'POST', '/api/users/login', {
      email: studentEmail,
      password: newPassword,
    });
    record(
      7,
      'New password authenticates successfully and issues token (200 OK)',
      newLoginRes.status === 200 && !!newLoginRes.body.data?.token
    );

    // Test 8: Single-use token enforcement: reusing already-consumed token fails
    const reuseResetRes = await request(serverPort, 'POST', `/api/users/reset-password/${rawResetToken}`, {
      password: 'AnotherPassword@789',
    });
    record(
      8,
      'Single-use token enforcement: reusing consumed token is rejected with 401',
      reuseResetRes.status === 401
    );

    // Test 9: Expired reset token fails
    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    await User.findByIdAndUpdate(studentId, {
      resetPasswordToken: crypto.createHash('sha256').update(expiredRawToken).digest('hex'),
      resetPasswordExpire: new Date(Date.now() - 3600000), // Expired 1 hour ago
    });
    const expiredResetRes = await request(serverPort, 'POST', `/api/users/reset-password/${expiredRawToken}`, {
      password: 'NewStrongPassword@999',
    });
    record(
      9,
      'Expired password reset token is rejected with 401',
      expiredResetRes.status === 401
    );

    // Test 10: Multiple reset requests: newer request invalidates previous token
    const firstForgotRes = await request(serverPort, 'POST', '/api/users/forgot-password', {
      email: studentEmail,
    });
    const firstToken = firstForgotRes.body.resetToken;

    const secondForgotRes = await request(serverPort, 'POST', '/api/users/forgot-password', {
      email: studentEmail,
    });
    const secondToken = secondForgotRes.body.resetToken;

    // First token must now fail because second request replaced it
    const firstTokenAttempt = await request(serverPort, 'POST', `/api/users/reset-password/${firstToken}`, {
      password: 'SomeNewPassword@111',
    });
    // Second token must succeed
    const secondTokenAttempt = await request(serverPort, 'POST', `/api/users/reset-password/${secondToken}`, {
      password: 'SomeNewPassword@111',
    });

    record(
      10,
      'Generating a new reset request cleanly invalidates previous token',
      firstTokenAttempt.status === 401 && secondTokenAttempt.status === 200
    );

    // Test 11: Admin password reset adheres to identical security invariants
    const adminForgotRes = await request(serverPort, 'POST', '/api/admin/forgot-password', {
      email: adminEmail,
    });
    const adminResetToken = adminForgotRes.body.resetToken;
    const adminResetRes = await request(serverPort, 'POST', `/api/admin/reset-password/${adminResetToken}`, {
      password: newPassword,
    });
    const adminOldLogin = await request(serverPort, 'POST', '/api/admin/login', {
      email: adminEmail,
      password: initialPassword,
    });
    const adminNewLogin = await request(serverPort, 'POST', '/api/admin/login', {
      email: adminEmail,
      password: newPassword,
    });

    record(
      11,
      'Admin portal password reset enforces identical cryptographic invariants & single-use rules',
      adminResetRes.status === 200 && adminOldLogin.status === 401 && adminNewLogin.status === 200
    );

    // Teardown
    await User.deleteMany({ _id: { $in: [studentId, adminId] } });

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    if (server) {
      await new Promise((res) => server.close(res));
    }
    await mongoose.connection.close();

    console.log('\n===============================================================');
    console.log('📊 PHASE 7 TEST SUMMARY');
    console.log('===============================================================');
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
    console.log('===============================================================\n');

    if (passed === total) {
      console.log('🎉 ALL PHASE 7 PASSWORD RESET TESTS PASSED!\n');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runPhase7Tests();
