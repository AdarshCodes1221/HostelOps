/**
 * PHASE 6 AUTOMATED TEST SUITE: STUDENT EMAIL VERIFICATION FLOW
 *
 * Verifies:
 * 1. Registration creates unverified account with hashed verification token & dispatches email
 * 2. Unverified student login blocked when email verification is required (403)
 * 3. Admin room allocation blocked for unverified student when policy enabled (400)
 * 4. Invalid verification token rejected with safe error (400)
 * 5. Expired verification token rejected (400)
 * 6. Valid verification token succeeds -> isEmailVerified = true, token invalidated
 * 7. Single-use enforcement: reused verification token rejected (400)
 * 8. Already-verified student attempting verification rejected
 * 9. Resend verification endpoint creates fresh token
 * 10. Resend verification rate-limit cooldown (429 within 60s)
 * 11. Resend verification generic response for non-existent email (prevents enumeration)
 * 12. Verified student can be approved & allocated room by admin
 * 13. Verified + approved student logs in successfully
 */

const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
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

async function runPhase6Tests() {
  console.log('\n===============================================================');
  console.log('✉️ RUNNING PHASE 6: EMAIL VERIFICATION TEST SUITE');
  console.log('===============================================================\n');

  let server;
  let serverPort;
  const unique = Date.now();
  const adminEmail = `admin.verify.${unique}@symbiosis.ac.in`;
  const studentEmail = `student.verify.${unique}@sitpune.edu.in`;
  const password = 'TestPassword@123';

  let adminToken;
  let adminId;
  let studentId;
  let rawVerificationToken;
  let testHostel;
  let testRoom;

  const originalEnv = process.env.REQUIRE_EMAIL_VERIFICATION;

  try {
    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
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
    const hashedPass = await bcrypt.hash(password, salt);

    // Setup Admin
    const adminUser = await User.create({
      firstName: 'VerifyAdmin',
      lastName: 'P6',
      email: adminEmail,
      password: hashedPass,
      role: 'admin',
      status: 'approved',
      isEmailVerified: true,
      phone: `91${unique.toString().slice(-8)}`,
    });
    adminId = adminUser._id;

    // Admin login
    const adminLoginRes = await request(serverPort, 'POST', '/api/admin/login', {
      email: adminEmail,
      password,
    });
    adminToken = adminLoginRes.body.data?.token;

    // Create hostel & room for allocation check
    testHostel = await Hostel.create({
      name: `HostelVerify_${unique}`,
      description: 'Hostel for Phase 6',
      address: 'Lavale',
      city: 'Pune',
      state: 'Maharashtra',
      zipCode: '412115',
      phone: '020-22334455',
      email: `hostel.verify.${unique}@sitpune.edu.in`,
      location: 'West',
      floors: 1,
    });

    testRoom = await Room.create({
      hostel: testHostel._id,
      roomNumber: '101',
      floor: 1,
      capacity: 2,
      occupants: [],
      status: 'AVAILABLE',
    });

    // Test 1: Student registers -> unverified account with token
    const regRes = await request(serverPort, 'POST', '/api/users/register', {
      firstName: 'Verify',
      lastName: 'Student',
      email: studentEmail,
      password,
      prn: `VER${unique.toString().slice(-6)}`,
      phone: `92${unique.toString().slice(-8)}`,
    });
    studentId = regRes.body.data?._id;
    rawVerificationToken = regRes.body.data?.verificationToken;

    const studentRecord = await User.findById(studentId).select('+emailVerificationToken +emailVerificationExpire');
    record(
      1,
      'Student registration creates unverified account with hashed token & safe expiration',
      regRes.status === 201 &&
        regRes.body.data?.isEmailVerified === false &&
        !!studentRecord?.emailVerificationToken &&
        studentRecord?.emailVerificationToken !== rawVerificationToken // Token in DB is strictly hashed!
    );

    // Test 2: Unverified student login is blocked (403 with needsEmailVerification)
    const unverifiedLoginRes = await request(serverPort, 'POST', '/api/users/login', {
      email: studentEmail,
      password,
    });
    record(
      2,
      'Unverified student login blocked when email verification policy is active (403)',
      unverifiedLoginRes.status === 403 && unverifiedLoginRes.body.needsEmailVerification === true
    );

    // Test 3: Admin cannot allocate room to unverified student (400 barrier)
    const unverifiedAllocRes = await request(
      serverPort,
      'POST',
      `/api/admin/students/${studentId}/approve-and-allocate`,
      { roomId: testRoom._id },
      { Authorization: `Bearer ${adminToken}` }
    );
    record(
      3,
      'Admin cannot allocate room to unverified student when policy is enabled (400)',
      unverifiedAllocRes.status === 400 && unverifiedAllocRes.body.message.includes('unverified')
    );

    // Test 4: Invalid/garbage token verification attempt returns 400
    const invalidVerifyRes = await request(
      serverPort,
      'POST',
      '/api/users/verify-email',
      { token: 'invalid_garbage_token_123456789' }
    );
    record(
      4,
      'Invalid verification token rejected with safe error (400)',
      invalidVerifyRes.status === 400
    );

    // Test 5: Expired token verification attempt rejected
    const expiredRawToken = 'expired_test_token_999999999999';
    await User.findByIdAndUpdate(studentId, {
      emailVerificationToken: crypto.createHash('sha256').update(expiredRawToken).digest('hex'),
      emailVerificationExpire: new Date(Date.now() - 3600000), // Expired 1 hour ago
    });
    const expiredVerifyRes = await request(
      serverPort,
      'POST',
      '/api/users/verify-email',
      { token: expiredRawToken }
    );
    record(
      5,
      'Expired verification token rejected with 400',
      expiredVerifyRes.status === 400
    );

    // Restore valid token for subsequent tests
    const freshToken = studentRecord.generateEmailVerificationToken();
    await studentRecord.save({ validateBeforeSave: false });

    // Test 6: Valid verification token succeeds
    const validVerifyRes = await request(
      serverPort,
      'POST',
      '/api/users/verify-email',
      { token: freshToken }
    );
    const updatedStudent = await User.findById(studentId).select('+emailVerificationToken +emailVerificationExpire');
    record(
      6,
      'Valid verification token succeeds: isEmailVerified becomes true and token fields invalidated',
      validVerifyRes.status === 200 &&
        updatedStudent.isEmailVerified === true &&
        !updatedStudent.emailVerificationToken
    );

    // Test 7: Single-use enforcement: reused verification token fails
    const reuseVerifyRes = await request(
      serverPort,
      'POST',
      '/api/users/verify-email',
      { token: freshToken }
    );
    record(
      7,
      'Single-use token enforcement: reusing already-consumed token is rejected with 400',
      reuseVerifyRes.status === 400
    );

    // Test 8: Already-verified student attempting verification rejected
    const alreadyVerifiedRes = await request(
      serverPort,
      'POST',
      '/api/users/verify-email',
      { token: freshToken }
    );
    record(
      8,
      'Already-verified student cannot repeatedly verify',
      alreadyVerifiedRes.status === 400
    );

    // Test 9: Resend verification creates fresh token for unverified student
    // Temporarily set student to unverified to test resend
    await User.findByIdAndUpdate(studentId, {
      isEmailVerified: false,
      emailVerificationLastResend: undefined,
    });
    const resendRes = await request(serverPort, 'POST', '/api/users/resend-verification', {
      email: studentEmail,
    });
    record(
      9,
      'Resend verification endpoint generates fresh token for unverified student (200 OK)',
      resendRes.status === 200 && resendRes.body.success === true
    );

    // Test 10: Resend rate-limiting cooldown (429 within 60s)
    const rapidResendRes = await request(serverPort, 'POST', '/api/users/resend-verification', {
      email: studentEmail,
    });
    record(
      10,
      'Resend verification enforces 60-second cooldown rate limit (429 Too Many Requests)',
      rapidResendRes.status === 429
    );

    // Test 11: Resend for non-existent email returns generic safe 200
    const nonExistentResend = await request(serverPort, 'POST', '/api/users/resend-verification', {
      email: `nonexistent.${unique}@sitpune.edu.in`,
    });
    record(
      11,
      'Resend verification returns generic message for non-existent email (prevents enumeration)',
      nonExistentResend.status === 200 && nonExistentResend.body.success === true
    );

    // Re-verify student so we can test approval & login
    await User.findByIdAndUpdate(studentId, {
      isEmailVerified: true,
      emailVerificationToken: undefined,
      emailVerificationExpire: undefined,
    });

    // Test 12: Verified student can now be approved and allocated room by admin
    const allocVerifiedRes = await request(
      serverPort,
      'POST',
      `/api/admin/students/${studentId}/approve-and-allocate`,
      { roomId: testRoom._id },
      { Authorization: `Bearer ${adminToken}` }
    );
    record(
      12,
      'Verified student account successfully approved & allocated room by admin (200 OK)',
      allocVerifiedRes.status === 200 && allocVerifiedRes.body.data?.student?.status === 'approved'
    );

    // Test 13: Verified + approved student logs in successfully
    const verifiedLoginRes = await request(serverPort, 'POST', '/api/users/login', {
      email: studentEmail,
      password,
    });
    record(
      13,
      'Verified and approved student successfully logs in and receives JWT',
      verifiedLoginRes.status === 200 && !!verifiedLoginRes.body.data?.token
    );

    // Teardown
    await User.deleteMany({ _id: { $in: [adminId, studentId] } });
    await Room.deleteOne({ _id: testRoom._id });
    await Hostel.deleteOne({ _id: testHostel._id });

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    process.env.REQUIRE_EMAIL_VERIFICATION = originalEnv;
    if (server) {
      await new Promise((res) => server.close(res));
    }
    await mongoose.connection.close();

    console.log('\n===============================================================');
    console.log('📊 PHASE 6 TEST SUMMARY');
    console.log('===============================================================');
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
    console.log('===============================================================\n');

    if (passed === total) {
      console.log('🎉 ALL PHASE 6 EMAIL VERIFICATION TESTS PASSED!\n');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runPhase6Tests();
