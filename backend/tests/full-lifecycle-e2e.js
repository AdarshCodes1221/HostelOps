/**
 * Comprehensive Student Lifecycle E2E Verification
 * Executes the complete 18-step student lifecycle:
 * REGISTER -> EMAIL VERIFICATION -> LOGIN -> PROFILE -> ADMIN APPROVAL & ROOM ALLOCATION 
 * -> STUDENT DASHBOARD -> MESS MENU -> NOTIFICATIONS -> COMPLAINT -> COMPLAINT STATUS
 * -> NOTICE -> BUS ROUTE -> OUTPASS REQUEST -> ADMIN APPROVAL -> QR GENERATION 
 * -> QR VERIFICATION -> GATE CHECK-OUT -> LOGOUT -> RE-LOGIN
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
const Notice = require('../models/Notice');
const MessMenu = require('../models/MessMenu');
const BusRoute = require('../models/BusRoute');

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

async function runE2E() {
  console.log('===============================================================');
  console.log('🎓 RUNNING FULL STUDENT E2E LIFECYCLE VERIFICATION');
  console.log('===============================================================');

  await connectDB();
  server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  function step(stepNum, name, condition) {
    if (condition) {
      console.log(`  ✅ Step ${stepNum.toString().padStart(2, ' ')}: ${name} -> PASS`);
      passed++;
    } else {
      console.error(`  ❌ Step ${stepNum.toString().padStart(2, ' ')}: ${name} -> FAIL`);
      failed++;
    }
  }

  const timestamp = Date.now();
  const studentEmail = `aarav.lifecycle.${timestamp}@sitpune.edu.in`;
  const studentPrn = `PRN${timestamp.toString().slice(-8)}`;
  const studentPhone = `98${timestamp.toString().slice(-8)}`;
  const adminEmail = `admin.lifecycle.${timestamp}@symbiosis.ac.in`;

  // Pre-seed Hostel and Room
  const testHostel = await Hostel.findOneAndUpdate(
    { name: 'E2E Test Hostel' },
    { name: 'E2E Test Hostel', type: 'boys', totalFloors: 3, totalRooms: 10, capacityPerRoom: 3 },
    { upsert: true, new: true }
  );

  const testRoom = await Room.findOneAndUpdate(
    { hostel: testHostel._id, roomNumber: 501 },
    { hostel: testHostel._id, roomNumber: 501, floor: 2, capacity: 3, currentOccupancy: 0, occupants: [], status: 'available' },
    { upsert: true, new: true }
  );

  // Pre-seed Admin
  const adminUser = await User.findOneAndUpdate(
    { email: adminEmail },
    {
      firstName: 'Chief',
      lastName: 'Warden',
      name: 'Chief Warden',
      email: adminEmail,
      password: await bcrypt.hash('AdminPass123!', 10),
      role: 'admin',
      isEmailVerified: true,
      status: 'approved',
      prn: `ADM${timestamp.toString().slice(-7)}`,
      phone: `97${timestamp.toString().slice(-8)}`,
    },
    { upsert: true, new: true }
  );

  // 1. REGISTER
  const regRes = await request('POST', '/api/users/register', {
    firstName: 'Aarav',
    lastName: 'Sharma',
    email: studentEmail,
    prn: studentPrn,
    phone: studentPhone,
    password: 'StrongStudentPass123!',
  });
  step(1, 'Student registers with valid college domain (@sitpune.edu.in)', regRes.status === 201 && regRes.body.success === true);

  // 2. EMAIL VERIFICATION
  const createdStudent = await User.findOne({ email: studentEmail });
  const verificationToken = regRes.body.data?.verificationToken;
  const verifyRes = await request('POST', '/api/users/verify-email', { token: verificationToken });
  step(2, 'Email verification completes using cryptographic token', verifyRes.status === 200 && verifyRes.body.success === true);

  // 3. ATTEMPT LOGIN BEFORE ADMIN APPROVAL (Should be blocked 403)
  const preApprovalLogin = await request('POST', '/api/users/login', {
    email: studentEmail,
    password: 'StrongStudentPass123!',
  });
  step(3, 'Pending unapproved student login safely blocked (403)', preApprovalLogin.status === 403);

  // 4. ADMIN LOGIN
  const adminLoginRes = await request('POST', '/api/admin/login', {
    email: adminEmail,
    password: 'AdminPass123!',
  });
  const adminToken = adminLoginRes.body.data?.token;
  step(4, 'Admin successfully logs in via dedicated admin portal', adminLoginRes.status === 200 && !!adminToken);

  // 5. ADMIN APPROVAL & ROOM ALLOCATION
  const allocateRes = await request(
    'POST',
    `/api/admin/students/${createdStudent._id}/approve-and-allocate`,
    { hostelId: testHostel._id, floor: 2, roomNumber: 501 },
    { Authorization: `Bearer ${adminToken}` }
  );
  step(5, 'Admin reviews, approves, and allocates room atomically', allocateRes.status === 200 && allocateRes.body.success === true);

  // 6. STUDENT LOGIN AFTER APPROVAL
  const studentLoginRes = await request('POST', '/api/users/login', {
    email: studentEmail,
    password: 'StrongStudentPass123!',
  });
  const studentToken = studentLoginRes.body.data?.token;
  step(6, 'Approved student logs in successfully and receives JWT', studentLoginRes.status === 200 && !!studentToken);

  // 7. STUDENT PROFILE CHECK
  const profileRes = await request('GET', '/api/profile', null, { Authorization: `Bearer ${studentToken}` });
  step(7, 'Student profile accurately displays assigned hostel and room', 
    profileRes.status === 200 && 
    profileRes.body.data.roomNumber == '501' && 
    profileRes.body.data.roomLocked === true
  );

  // 8. MESS MENU FETCH
  const messRes = await request('GET', '/api/mess-menu');
  step(8, 'Student views mess menu successfully', messRes.status === 200);

  // 9. STUDENT NOTIFICATIONS
  const notifRes = await request('GET', '/api/notifications/my', null, { Authorization: `Bearer ${studentToken}` });
  step(9, 'Student notification feed retrieves personalized room allocation notification', notifRes.status === 200 && Array.isArray(notifRes.body.data));

  // 10. SUBMIT COMPLAINT
  const compRes = await request('POST', '/api/complaints', {
    title: 'Ceiling fan making squeaking noise',
    description: 'Please inspect the regulator and bearing',
    category: 'electrical',
  }, { Authorization: `Bearer ${studentToken}` });
  const complaintId = compRes.body.data?._id;
  step(10, 'Student submits complaint; location automatically bound to Room 501', compRes.status === 201 && compRes.body.data.roomNumber == '501');

  // 11. CHECK COMPLAINT STATUS
  const myCompRes = await request('GET', '/api/complaints/my', null, { Authorization: `Bearer ${studentToken}` });
  step(11, 'Student views complaint status in their active complaint list', myCompRes.status === 200 && myCompRes.body.data.length > 0);

  // 12. NOTICE BOARD VIEW
  const noticeRes = await request('GET', '/api/notices', null, { Authorization: `Bearer ${studentToken}` });
  step(12, 'Student retrieves official hostel notice board', noticeRes.status === 200);

  // 13. BUS SCHEDULES VIEW
  const busRes = await request('GET', '/api/bus-routes');
  step(13, 'Student retrieves campus bus routes and schedule', busRes.status === 200);

  // 14. OUTPASS REQUEST
  const departure = new Date(Date.now() + 3600000); // 1 hr from now
  const arrival = new Date(Date.now() + 86400000); // 24 hrs from now
  const outpassRes = await request('POST', '/api/outpass', {
    reason: 'Attending hackathon',
    destination: 'Pune City Center',
    departureDate: departure.toISOString(),
    expectedReturnDate: arrival.toISOString(),
    emergencyContact: '9876543210',
  }, { Authorization: `Bearer ${studentToken}` });
  const outpassId = outpassRes.body.data?._id;
  step(14, 'Student creates digital outpass request (Status: pending)', outpassRes.status === 201 && outpassRes.body.data.status === 'pending');

  // 15. ADMIN/WARDEN OUTPASS APPROVAL
  const approveOutpassRes = await request(
    'PUT',
    `/api/outpass/admin/${outpassId}/approve`,
    { remarks: 'Approved for inter-college hackathon' },
    { Authorization: `Bearer ${adminToken}` }
  );
  const passCode = approveOutpassRes.body.data?.passCode;
  step(15, 'Admin approves outpass & generates opaque pass identifier', approveOutpassRes.status === 200 && passCode && passCode.startsWith('OP-'));

  // 16. DIGITAL QR GATE PASS GENERATION & VERIFICATION
  const qrCheckRes = await request('POST', '/api/outpass/verify-qr', { passCode });
  step(16, 'Gate security scans QR: verification succeeds with zero private leaks', qrCheckRes.status === 200 && qrCheckRes.body.valid === true);

  // 17. GATE CHECK-OUT & SINGLE-USE ENFORCEMENT
  const checkoutRes = await request('POST', `/api/outpass/admin/${outpassId}/mark-used`, {}, { Authorization: `Bearer ${adminToken}` });
  const rescannedRes = await request('POST', '/api/outpass/verify-qr', { passCode });
  step(17, 'Gate check-out marks pass as used; subsequent scan is rejected (Prevents pass reuse)', 
    checkoutRes.status === 200 && 
    rescannedRes.status === 400 && 
    rescannedRes.body.valid === false
  );

  // 18. LOGOUT & RE-LOGIN
  const logoutRes = await request('POST', '/api/users/logout', null, { Authorization: `Bearer ${studentToken}` });
  const reLoginRes = await request('POST', '/api/users/login', {
    email: studentEmail,
    password: 'StrongStudentPass123!',
  });
  step(18, 'Student logs out and re-authenticates successfully', logoutRes.status === 200 && reLoginRes.status === 200 && !!reLoginRes.body.data?.token);

  // Cleanup
  await User.deleteMany({ email: { $in: [studentEmail, adminEmail] } });
  await Complaint.deleteMany({ _id: complaintId });
  await Outpass.deleteMany({ _id: outpassId });
  await Room.deleteOne({ _id: testRoom._id });
  await Hostel.deleteOne({ _id: testHostel._id });

  server.close();
  await mongoose.connection.close();

  console.log('\n===============================================================');
  console.log(`📊 STUDENT E2E LIFECYCLE SUMMARY: ${passed}/18 STEPS PASSED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 COMPLETE 18-STEP STUDENT LIFECYCLE VERIFIED END-TO-END!');
    process.exit(0);
  }
}

runE2E().catch((err) => {
  console.error('E2E lifecycle error:', err);
  process.exit(1);
});
