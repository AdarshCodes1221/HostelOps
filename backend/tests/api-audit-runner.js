/**
 * Comprehensive API Endpoint Verification Script
 * Validates authentication enforcement, role restrictions, IDOR isolation, 
 * malformed inputs, NoSQL injection resilience, and sensitive data leak prevention
 * across all endpoints in the Hostel Management System.
 */

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = require('../server');
const connectDB = require('../config/database');
const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Complaint = require('../models/Complaint');
const Outpass = require('../models/Outpass');
const Notification = require('../models/Notification');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(baseUrl + path);
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';

    const reqHeaders = {
      ...headers,
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {}),
    };

    const req = http.request(
      url,
      { method, headers: reqHeaders },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', (err) => {
      resolve({ status: 500, error: err.message, body: null });
    });

    if (body) req.write(postData);
    req.end();
  });
}

// Data leak detection helper
const SENSITIVE_PATTERNS = [
  /passwordHash/i,
  /hashedPassword/i,
  /"password":\s*"[^"]{5,}"/i,
  /JWT_SECRET/i,
  /SMTP_PASSWORD/i,
  /mongodb(\+srv)?:\/\//i,
  /resetTokenHash/i,
  /verificationTokenHash/i,
  /stack\s*trace/i,
  /[A-Za-z]:\\[\w\\]+/i, // Windows filesystem paths
  /\/home\/\w+/i, // Unix filesystem paths
];

function checkDataLeaks(responseBody) {
  const bodyStr = typeof responseBody === 'object' ? JSON.stringify(responseBody) : String(responseBody);
  const leaks = [];
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(bodyStr)) {
      leaks.push(pattern.toString());
    }
  }
  return leaks;
}

async function runAudit() {
  console.log('===============================================================');
  console.log('🔍 INITIATING DEEP API ENDPOINT AUDIT & LEAK VERIFICATION');
  console.log('===============================================================');

  await connectDB();
  server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`Server listening on ${baseUrl}`);

  let passedChecks = 0;
  let failedChecks = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passedChecks++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failedChecks++;
    }
  }

  // 1. Setup Test Users
  const timestamp = Date.now();
  const studentEmail = `audit.student.${timestamp}@sitpune.edu.in`;
  const studentEmail2 = `audit.student2.${timestamp}@sitpune.edu.in`;
  const adminEmail = `audit.admin.${timestamp}@symbiosis.ac.in`;

  // Create Hostel & Room
  const testHostel = await Hostel.findOneAndUpdate(
    { name: 'Audit Test Hostel' },
    { name: 'Audit Test Hostel', type: 'boys', totalFloors: 2, totalRooms: 4, capacityPerRoom: 3 },
    { upsert: true, new: true }
  );

  const testRoom = await Room.findOneAndUpdate(
    { hostel: testHostel._id, roomNumber: 991 },
    { hostel: testHostel._id, roomNumber: 991, floor: 1, capacity: 3, currentOccupancy: 0, occupants: [], status: 'available' },
    { upsert: true, new: true }
  );

  // Register Student 1
  const regRes = await request('POST', '/api/users/register', {
    firstName: 'Audit',
    lastName: 'Student1',
    email: studentEmail,
    prn: `PRN${timestamp.toString().slice(-8)}`,
    phone: `98${timestamp.toString().slice(-8)}`,
    password: 'StrongPass123!',
  });
  assert(regRes.status === 201, 'Student 1 registration returns 201');
  const student1User = await User.findOne({ email: studentEmail });
  student1User.isEmailVerified = true;
  student1User.status = 'approved';
  student1User.hostel = testHostel.name;
  student1User.floor = '1';
  student1User.roomNumber = '991';
  student1User.room = testRoom._id;
  await student1User.save();

  // Register Student 2
  const regRes2 = await request('POST', '/api/users/register', {
    firstName: 'Audit',
    lastName: 'Student2',
    email: studentEmail2,
    prn: `PRN${(timestamp + 1).toString().slice(-8)}`,
    phone: `99${timestamp.toString().slice(-8)}`,
    password: 'StrongPass123!',
  });
  assert(regRes2.status === 201, 'Student 2 registration returns 201');
  const student2User = await User.findOne({ email: studentEmail2 });
  student2User.isEmailVerified = true;
  student2User.status = 'approved';
  await student2User.save();

  // Create Admin
  const adminUser = await User.findOneAndUpdate(
    { email: adminEmail },
    {
      firstName: 'Audit',
      lastName: 'Admin',
      name: 'Audit Admin',
      email: adminEmail,
      password: await bcrypt.hash('AdminPassword123!', 10),
      role: 'admin',
      isEmailVerified: true,
      status: 'approved',
      prn: `ADM${timestamp.toString().slice(-7)}`,
      phone: `97${timestamp.toString().slice(-8)}`,
    },
    { upsert: true, new: true }
  );

  // Login tokens
  const studentLoginRes = await request('POST', '/api/users/login', {
    email: studentEmail,
    password: 'StrongPass123!',
  });
  const studentToken = studentLoginRes.body.data?.token;

  const student2LoginRes = await request('POST', '/api/users/login', {
    email: studentEmail2,
    password: 'StrongPass123!',
  });
  const student2Token = student2LoginRes.body.data?.token;

  const adminLoginRes = await request('POST', '/api/admin/login', {
    email: adminEmail,
    password: 'AdminPassword123!',
  });
  const adminToken = adminLoginRes.body.data?.token;

  // 2. Health endpoint checks
  console.log('\n--- 1. HEALTH CHECKS ---');
  const healthRes = await request('GET', '/api/health');
  assert(healthRes.status === 200 && healthRes.body.status === 'ok', 'GET /api/health returns 200 ok');
  assert(checkDataLeaks(healthRes.body).length === 0, 'GET /api/health contains no data leaks');

  // 3. Auth Token Enforcement Checks (Missing, Invalid, Expired)
  console.log('\n--- 2. AUTH TOKEN INTEGRITY ON PROTECTED ROUTES ---');
  const noAuthRes = await request('GET', '/api/profile');
  assert(noAuthRes.status === 401, 'GET /api/profile without auth returns 401');

  const invalidAuthRes = await request('GET', '/api/profile', null, { Authorization: 'Bearer invalid.token.xyz' });
  assert(invalidAuthRes.status === 401, 'GET /api/profile with invalid token returns 401');

  const expiredToken = jwt.sign({ id: student1User._id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '-1s' });
  const expiredAuthRes = await request('GET', '/api/profile', null, { Authorization: `Bearer ${expiredToken}` });
  assert(expiredAuthRes.status === 401, 'GET /api/profile with expired token returns 401');

  // 4. Role Authorization Checks (Student accessing Admin endpoints)
  console.log('\n--- 3. ROLE-BASED ACCESS CONTROL (RBAC) ---');
  const rbacRes1 = await request('GET', '/api/admin/dashboard', null, { Authorization: `Bearer ${studentToken}` });
  assert(rbacRes1.status === 403, 'Student forbidden from GET /api/admin/dashboard (403)');

  const rbacRes2 = await request('GET', '/api/admin/pending-students', null, { Authorization: `Bearer ${studentToken}` });
  assert(rbacRes2.status === 403, 'Student forbidden from GET /api/admin/pending-students (403)');

  const rbacRes3 = await request('POST', '/api/rooms', { roomNumber: 888, hostel: testHostel._id, floor: 1, capacity: 2 }, { Authorization: `Bearer ${studentToken}` });
  assert(rbacRes3.status === 403, 'Student forbidden from POST /api/rooms (403)');

  const rbacRes4 = await request('POST', '/api/notices', { title: 'Test', description: 'Test' }, { Authorization: `Bearer ${studentToken}` });
  assert(rbacRes4.status === 403, 'Student forbidden from POST /api/notices (403)');

  // 5. IDOR Tests across Complaints, Profile, Bookings, Outpasses
  console.log('\n--- 4. IDOR ISOLATION VERIFICATION ---');
  // Student 1 creates complaint
  const compRes = await request('POST', '/api/complaints', {
    title: 'Broken lamp',
    description: 'Broken lamp in room',
    category: 'electrical',
  }, { Authorization: `Bearer ${studentToken}` });
  if (compRes.status !== 201) {
    console.error('Complaint creation error body:', compRes.status, compRes.body);
  }
  assert(compRes.status === 201, 'Student 1 creates complaint successfully');
  const complaintId = compRes.body.data?._id;

  // Student 2 tries to view Student 1 complaint
  const idorCompRes = await request('GET', `/api/complaints/${complaintId}`, null, { Authorization: `Bearer ${student2Token}` });
  assert(idorCompRes.status === 403, 'IDOR blocked: Student 2 cannot access Student 1 complaint (403)');

  // Student 1 creates outpass
  const tomorrow = new Date(Date.now() + 86400000);
  const outpassRes = await request('POST', '/api/outpass', {
    reason: 'Family event',
    destination: 'Mumbai',
    departureDate: new Date().toISOString(),
    expectedReturnDate: tomorrow.toISOString(),
    emergencyContact: '9876543210',
  }, { Authorization: `Bearer ${studentToken}` });
  assert(outpassRes.status === 201, 'Student 1 creates outpass successfully');
  const outpassId = outpassRes.body.data._id;

  // Student 2 tries to view Student 1 outpass
  const idorOutpassRes = await request('GET', `/api/outpass/${outpassId}`, null, { Authorization: `Bearer ${student2Token}` });
  assert(idorOutpassRes.status === 403, 'IDOR blocked: Student 2 cannot access Student 1 outpass (403)');

  // 6. Data Leak Audit Across Endpoints
  console.log('\n--- 5. SENSITIVE DATA LEAK AUDIT ---');
  const profileRes = await request('GET', '/api/profile', null, { Authorization: `Bearer ${studentToken}` });
  assert(profileRes.status === 200, 'GET /api/profile returns 200');
  const profileLeaks = checkDataLeaks(profileRes.body);
  assert(profileLeaks.length === 0, 'GET /api/profile response contains 0 sensitive data leaks');
  assert(profileRes.body.data.password === undefined, 'GET /api/profile does NOT expose password field');

  const adminUsersRes = await request('GET', '/api/admin/users', null, { Authorization: `Bearer ${adminToken}` });
  assert(adminUsersRes.status === 200, 'GET /api/admin/users returns 200');
  const usersLeaks = checkDataLeaks(adminUsersRes.body);
  assert(usersLeaks.length === 0, 'GET /api/admin/users response contains 0 sensitive data leaks');

  const outpassDetailRes = await request('GET', `/api/outpass/${outpassId}`, null, { Authorization: `Bearer ${studentToken}` });
  assert(outpassDetailRes.status === 200, 'GET /api/outpass/:id returns 200');
  const outpassLeaks = checkDataLeaks(outpassDetailRes.body);
  assert(outpassLeaks.length === 0, 'GET /api/outpass/:id response contains 0 sensitive data leaks');

  // 7. NoSQL Injection & Malformed Input Handling
  console.log('\n--- 6. INPUT VALIDATION & NOSQL INJECTION DEFENSE ---');
  const nosqlRes = await request('POST', '/api/users/login', {
    email: { $gt: '' },
    password: { $gt: '' },
  });
  assert(nosqlRes.status === 400, 'NoSQL injection object in login rejected with 400');

  const malformedIdRes = await request('GET', '/api/complaints/invalid-object-id', null, { Authorization: `Bearer ${studentToken}` });
  assert([400, 404].includes(malformedIdRes.status), 'Malformed MongoDB ObjectId safely handled with 400/404');
  assert(checkDataLeaks(malformedIdRes.body).length === 0, 'Malformed ID error does not leak stack trace or internal path');

  // 8. Gate Pass QR Verification Security
  console.log('\n--- 7. DIGITAL GATE PASS QR AUDIT ---');
  // Admin approves outpass
  const approveRes = await request('PUT', `/api/outpass/admin/${outpassId}/approve`, { remarks: 'Approved for travel' }, { Authorization: `Bearer ${adminToken}` });
  assert(approveRes.status === 200, 'Admin approves outpass (200)');
  const passCode = approveRes.body.data.passCode;
  assert(passCode && passCode.startsWith('OP-'), `Opaque passCode generated: ${passCode}`);

  // Public QR verification endpoint
  const qrVerifyRes = await request('POST', '/api/outpass/verify-qr', { passCode });
  assert(qrVerifyRes.status === 200 && qrVerifyRes.body.valid === true, 'Public QR gate verification succeeds (200)');
  assert(checkDataLeaks(qrVerifyRes.body).length === 0, 'QR verification response contains zero sensitive leaks');

  // Forged QR passCode test
  const forgedRes = await request('POST', '/api/outpass/verify-qr', { passCode: 'OP-FORGED99999999' });
  assert(forgedRes.status === 404 && forgedRes.body.valid === false, 'Forged QR passCode rejected (404)');

  // Cleanup test records
  await User.deleteMany({ email: { $in: [studentEmail, studentEmail2, adminEmail] } });
  await Complaint.deleteMany({ _id: complaintId });
  await Outpass.deleteMany({ _id: outpassId });
  await Room.deleteOne({ _id: testRoom._id });
  await Hostel.deleteOne({ _id: testHostel._id });

  server.close();
  await mongoose.connection.close();

  console.log('\n===============================================================');
  console.log(`📊 API AUDIT SUMMARY: ${passedChecks} Passed | ${failedChecks} Failed`);
  console.log('===============================================================');

  if (failedChecks > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL API AUDIT VERIFICATIONS PASSED WITH ZERO DATA LEAKS!');
    process.exit(0);
  }
}

runAudit().catch((err) => {
  console.error('Audit run error:', err);
  process.exit(1);
});
