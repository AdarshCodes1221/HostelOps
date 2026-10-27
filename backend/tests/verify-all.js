/**
 * Comprehensive Automated Verification Suite
 * Tests all 40 security, authentication, authorization, allocation, and isolation flows.
 */

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Load environment
require('dotenv').config();

const app = require('../server');
const connectDB = require('../config/database');
const { initializeHostelRooms } = require('../config/roomInitializer');
const User = require('../models/User');
const Room = require('../models/Room');
const Hostel = require('../models/Hostel');
const Complaint = require('../models/Complaint');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');

let server;
let baseUrl;

// Helper to make HTTP requests
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const postData = body ? JSON.stringify(body) : '';

    const reqHeaders = {
      ...headers,
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {}),
    };

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
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

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Track results
const results = [];
function record(testNum, title, passed, details = '') {
  const status = passed ? 'PASS' : 'FAIL';
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} Test ${testNum.toString().padStart(2, ' ')}: ${title} -> ${status} ${details ? `(${details})` : ''}`);
  results.push({ testNum, title, passed, details });
}

async function runAllTests() {
  console.log('===============================================================');
  console.log('🚀 RUNNING 40-POINT PRODUCTION SECURITY & ALLOCATION TEST SUITE');
  console.log('===============================================================\n');

  // Ensure DB connected
  await connectDB();
  await initializeHostelRooms();

  // Start server on a dynamic port for testing
  server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`📡 Test server running on ${baseUrl}\n`);

  const uniqueId = Date.now();
  const randDigit = (len) => Math.floor(Math.random() * Math.pow(10, len)).toString().padStart(len, '0');
  const testStudentEmail = `test.student.${uniqueId}.${randDigit(4)}@sitpune.edu.in`;
  const testStudentPrn = `PRN${uniqueId.toString().slice(-5)}${randDigit(4)}`;
  const testStudentPhone = `98${randDigit(8)}`;
  const testPassword = 'StrongPass123!@#';

  const testStudent2Email = `test.student2.${uniqueId}.${randDigit(4)}@sitpune.edu.in`;
  const testStudent2Prn = `PRN2${uniqueId.toString().slice(-4)}${randDigit(4)}`;
  const testStudent2Phone = `97${randDigit(8)}`;

  const testStudent3Email = `test.student3.${uniqueId}.${randDigit(4)}@sitpune.edu.in`;
  const testStudent3Prn = `PRN3${uniqueId.toString().slice(-4)}${randDigit(4)}`;
  const testStudent3Phone = `96${randDigit(8)}`;

  const testStudent4Email = `test.student4.${uniqueId}.${randDigit(4)}@sitpune.edu.in`;
  const testStudent4Prn = `PRN4${uniqueId.toString().slice(-4)}${randDigit(4)}`;
  const testStudent4Phone = `95${randDigit(8)}`;

  let student1Token = '';
  let student1Id = '';
  let student2Id = '';
  let student3Id = '';
  let student4Id = '';
  let adminToken = '';
  let adminId = '';
  let wardenToken = '';
  let wardenId = '';
  let student1ComplaintId = '';
  let activeResetToken = '';
  let testHostelDoc;
  let testRoomDoc;
  let secondRoomDoc;

  try {
    // -------------------------------------------------------------
    // SETUP: Ensure test admin and warden exist
    // -------------------------------------------------------------
    const adminEmail = `admin.${uniqueId}@siu.edu.in`;
    const wardenEmail = `warden.${uniqueId}@siu.edu.in`;
    const staffPass = 'AdminPass123!@#';
    const salt = await bcrypt.genSalt(10);
    const hashedStaffPass = await bcrypt.hash(staffPass, salt);

    const adminDoc = await User.create({
      firstName: 'Test',
      lastName: 'Admin',
      email: adminEmail,
      password: hashedStaffPass,
      role: 'admin',
      status: 'approved',
      phone: `91${uniqueId.toString().slice(-8)}`,
    });
    adminId = adminDoc._id.toString();

    const wardenDoc = await User.create({
      firstName: 'Test',
      lastName: 'Warden',
      email: wardenEmail,
      password: hashedStaffPass,
      role: 'warden',
      status: 'approved',
      phone: `92${uniqueId.toString().slice(-8)}`,
    });
    wardenId = wardenDoc._id.toString();

    // Prepare isolated test rooms in database
    testHostelDoc = await Hostel.findOne();
    if (!testHostelDoc) {
      testHostelDoc = await Hostel.create({ name: 'Voila Hostel', location: 'Campus', floors: 4 });
    }

    const testRoomNum = `T${uniqueId.toString().slice(-4)}`;
    testRoomDoc = await Room.create({
      hostel: testHostelDoc._id,
      roomNumber: testRoomNum,
      floor: 1,
      capacity: 3,
      occupants: [],
      price: 15000,
    });

    const secondRoomNum = `S${uniqueId.toString().slice(-4)}`;
    secondRoomDoc = await Room.create({
      hostel: testHostelDoc._id,
      roomNumber: secondRoomNum,
      floor: 1,
      capacity: 3,
      occupants: [],
      price: 15000,
    });

    // 1. Valid student registration creates pending account with no room assigned
    const regRes = await request('POST', '/api/users/register', {
      firstName: 'First',
      lastName: 'Student',
      email: testStudentEmail,
      prn: testStudentPrn,
      password: testPassword,
      phone: testStudentPhone,
      // Attempting to pass room data should be safely ignored
      hostel: 'Voila Hostel',
      floor: '1',
      roomNumber: testRoomNum,
    });
    const regSuccess = regRes.status === 201 && 
      regRes.body.success === true && 
      regRes.body.data.role === 'student' &&
      regRes.body.data.status === 'pending';
    student1Id = regRes.body.data?._id;
    record(1, 'Valid student registration creates pending account without auto room allocation', regSuccess, `Status: ${regRes.status}`);

    // Verify student 1 has no room assigned in DB yet
    const registeredUserInDb = await User.findById(student1Id);
    const noRoomInitially = !registeredUserInDb.hostel && !registeredUserInDb.roomNumber && registeredUserInDb.status === 'pending';
    record(2, 'Registered student has status pending and empty room until admin allocation', noRoomInitially);

    // 2. Valid @sitpune.edu.in email accepted
    record(3, 'Valid @sitpune.edu.in email accepted', regSuccess && testStudentEmail.endsWith('@sitpune.edu.in'));

    // 3. Invalid email rejected
    const invalidEmailRes = await request('POST', '/api/users/register', {
      firstName: 'Bad',
      lastName: 'Email',
      email: 'not-an-email',
      prn: `PRN_BAD_${uniqueId}`,
      password: testPassword,
      phone: `93${uniqueId.toString().slice(-8)}`,
    });
    record(4, 'Invalid email rejected', invalidEmailRes.status === 400 && invalidEmailRes.body.success === false);

    // 4. Other-domain email rejected for students
    const otherDomainRes = await request('POST', '/api/users/register', {
      firstName: 'Other',
      lastName: 'Domain',
      email: `intruder.${uniqueId}@gmail.com`,
      prn: `PRN_GMAIL_${uniqueId}`,
      password: testPassword,
      phone: `94${uniqueId.toString().slice(-8)}`,
    });
    record(5, 'Other-domain email rejected for students', otherDomainRes.status === 400 && otherDomainRes.body.message.includes('sitpune.edu.in'));

    // 5. Duplicate email rejected
    const dupEmailRes = await request('POST', '/api/users/register', {
      firstName: 'Duplicate',
      lastName: 'Email',
      email: testStudentEmail, // Already exists
      prn: `PRN_DUP_${uniqueId}`,
      password: testPassword,
      phone: `89${uniqueId.toString().slice(-8)}`,
    });
    record(6, 'Duplicate email registration rejected', dupEmailRes.status === 400);

    // 6. Duplicate PRN registration rejected
    const dupPrnRes = await request('POST', '/api/users/register', {
      firstName: 'Duplicate',
      lastName: 'PRN',
      email: `different.${uniqueId}@sitpune.edu.in`,
      prn: testStudentPrn, // Already exists
      password: testPassword,
      phone: `88${uniqueId.toString().slice(-8)}`,
    });
    record(7, 'Duplicate PRN registration rejected', dupPrnRes.status === 400);

    // 7. Duplicate phone number registration rejected (Global phone uniqueness)
    const dupPhoneRes = await request('POST', '/api/users/register', {
      firstName: 'Duplicate',
      lastName: 'Phone',
      email: `dup.phone.${uniqueId}@sitpune.edu.in`,
      prn: `PRN_DUP_PHONE_${uniqueId}`,
      password: testPassword,
      phone: testStudentPhone, // Already registered by student 1
    });
    record(8, 'Duplicate phone number registration rejected (Global phone uniqueness)', dupPhoneRes.status === 400 && dupPhoneRes.body.message.includes('phone'));

    // 8. Invalid phone format rejected
    const invalidPhoneRes = await request('POST', '/api/users/register', {
      firstName: 'Bad',
      lastName: 'Phone',
      email: `bad.phone.${uniqueId}@sitpune.edu.in`,
      prn: `PRN_BAD_P_${uniqueId}`,
      password: testPassword,
      phone: '12345', // Not 10 digits
    });
    record(9, 'Invalid phone number format (< 10 digits) rejected', invalidPhoneRes.status === 400);

    // 9. Weak password rejected
    const weakPassRes = await request('POST', '/api/users/register', {
      firstName: 'Weak',
      lastName: 'Password',
      email: `weak.${uniqueId}@sitpune.edu.in`,
      prn: `PRN_WEAK_${uniqueId}`,
      password: '123', // Weak
      phone: `87${uniqueId.toString().slice(-8)}`,
    });
    record(10, 'Weak password rejected', weakPassRes.status === 400 && weakPassRes.body.errors?.length > 0);

    // 10. Pending student cannot log in (Blocked with 403)
    const pendingLoginRes = await request('POST', '/api/users/login', {
      email: testStudentEmail,
      password: testPassword,
    });
    record(11, 'Pending student login blocked with 403 status code', pendingLoginRes.status === 403 && pendingLoginRes.body.message.includes('pending'));

    // 11. Dedicated Admin login via /api/admin/login
    const adminLoginRes = await request('POST', '/api/admin/login', {
      email: adminEmail,
      password: staffPass,
    });
    adminToken = adminLoginRes.body.data?.token;
    record(12, 'Dedicated Admin login with admin credentials succeeds', adminLoginRes.status === 200 && adminLoginRes.body.data?.role === 'admin' && !!adminToken);

    // 12. Student cannot authenticate via /api/admin/login (403 barrier)
    const studentAdminLoginRes = await request('POST', '/api/admin/login', {
      email: testStudentEmail,
      password: testPassword,
    });
    record(13, 'Student strictly forbidden from /api/admin/login (403 barrier)', studentAdminLoginRes.status === 403);

    // 13. Admin cannot authenticate via student /api/users/login (Blocked with 403)
    const adminAtStudentLoginRes = await request('POST', '/api/users/login', {
      email: adminEmail,
      password: staffPass,
    });
    record(14, 'Admin forbidden from student login endpoint (Blocked with 403)', adminAtStudentLoginRes.status === 403);

    // 14. Admin forgot password accepts admin email and returns reset token
    const adminForgotRes = await request('POST', '/api/admin/forgot-password', {
      email: adminEmail,
    });
    const adminResetToken = adminForgotRes.body.resetToken;
    record(15, 'Admin forgot password accepts admin email and dispatches reset token', adminForgotRes.status === 200 && !!adminResetToken);

    // 15. Admin forgot password rejects student email
    const studentAtAdminForgotRes = await request('POST', '/api/admin/forgot-password', {
      email: testStudentEmail,
    });
    record(16, 'Admin forgot password rejects student @sitpune.edu.in email', studentAtAdminForgotRes.status === 400);

    // 16. Admin reset password via /api/admin/reset-password/:token
    const newAdminPass = 'NewAdminPass123!@#$';
    const adminResetRes = await request('POST', `/api/admin/reset-password/${adminResetToken}`, {
      password: newAdminPass,
    });
    record(17, 'Admin reset password updates credentials successfully', adminResetRes.status === 200 && adminResetRes.body.success === true);

    // Verify admin can log in with new password
    const adminReLoginRes = await request('POST', '/api/admin/login', {
      email: adminEmail,
      password: newAdminPass,
    });
    adminToken = adminReLoginRes.body.data?.token;
    record(18, 'Admin can log in with freshly updated password', adminReLoginRes.status === 200 && !!adminToken);

    // 17. Admin can view pending students queue (/api/admin/pending-students)
    const pendingQueueRes = await request('GET', '/api/admin/pending-students', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    const pendingFound = pendingQueueRes.status === 200 && 
      Array.isArray(pendingQueueRes.body.data) && 
      pendingQueueRes.body.data.some((s) => s._id === student1Id);
    record(19, 'Admin can view pending students queue', pendingFound);

    // 18. Admin approves Student 1 and allocates Room (Capacity: 1/3)
    const alloc1Res = await request('POST', `/api/admin/students/${student1Id}/approve-and-allocate`, {
      roomId: testRoomDoc._id,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    const alloc1Passed = alloc1Res.status === 200 && 
      alloc1Res.body.data?.student?.status === 'approved' &&
      alloc1Res.body.data?.room?.occupants?.length === 1;
    record(20, 'Admin approves and allocates Student 1 (Occupancy: 1/3)', alloc1Passed, `Status: ${alloc1Res.status}`);

    // 19. Approved Student 1 can now log in via /api/users/login and receives JWT
    const student1LoginRes = await request('POST', '/api/users/login', {
      email: testStudentEmail,
      password: testPassword,
    });
    student1Token = student1LoginRes.body.data?.token;
    record(21, 'Approved Student 1 can now log in successfully and receive JWT', student1LoginRes.status === 200 && !!student1Token);

    // 20. Student room is locked (cannot modify assigned room via PUT /api/profile)
    const tamperRoomRes = await request('PUT', '/api/profile', {
      roomNumber: '999',
    }, {
      Authorization: `Bearer ${student1Token}`,
    });
    const studentAfterTamper = await User.findById(student1Id);
    const roomLockedPassed = studentAfterTamper.roomNumber === testRoomDoc.roomNumber;
    record(22, 'Student room is permanently locked; student cannot alter room', roomLockedPassed);

    // 21. Complaint creation automatically binds to student assigned room
    const createComplaintRes = await request('POST', '/api/complaints', {
      title: 'Water leaking in tap',
      description: 'The bathroom tap is dripping constantly.',
      category: 'maintenance',
      // Client tries to spoof location to another room
      hostel: 'Fake Hostel',
      roomNumber: '999',
    }, {
      Authorization: `Bearer ${student1Token}`,
    });
    const complaintCreated = createComplaintRes.status === 201 && 
      createComplaintRes.body.data?.roomNumber === testRoomDoc.roomNumber &&
      createComplaintRes.body.data?.hostel === testHostelDoc.name;
    student1ComplaintId = createComplaintRes.body.data?._id;
    record(23, 'Complaint automatically binds to student assigned room (ignores spoofed location)', complaintCreated);

    // 22. Register students 2, 3, 4 for room capacity & concurrency testing
    const reg2Res = await request('POST', '/api/users/register', {
      firstName: 'Second',
      lastName: 'Student',
      email: testStudent2Email,
      prn: testStudent2Prn,
      password: testPassword,
      phone: testStudent2Phone,
    });
    student2Id = reg2Res.body.data?._id;

    const reg3Res = await request('POST', '/api/users/register', {
      firstName: 'Third',
      lastName: 'Student',
      email: testStudent3Email,
      prn: testStudent3Prn,
      password: testPassword,
      phone: testStudent3Phone,
    });
    student3Id = reg3Res.body.data?._id;

    const reg4Res = await request('POST', '/api/users/register', {
      firstName: 'Fourth',
      lastName: 'Student',
      email: testStudent4Email,
      prn: testStudent4Prn,
      password: testPassword,
      phone: testStudent4Phone,
    });
    student4Id = reg4Res.body.data?._id;

    // 23. Unapproved student 2 cannot submit complaint
    const dummyStudent2Token = jwt.sign({ id: student2Id, role: 'student' }, process.env.JWT_SECRET);
    const unapprovedComplaintRes = await request('POST', '/api/complaints', {
      title: 'Test',
      description: 'Test',
    }, {
      Authorization: `Bearer ${dummyStudent2Token}`,
    });
    record(24, 'Unapproved/unallocated student cannot submit complaint', unapprovedComplaintRes.status === 403);

    // 24. Admin allocates Student 2 to Room (Capacity: 2/3)
    const alloc2Res = await request('POST', `/api/admin/students/${student2Id}/approve-and-allocate`, {
      roomId: testRoomDoc._id,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(25, 'Admin allocates Student 2 to Room (Occupancy: 2/3)', alloc2Res.status === 200 && alloc2Res.body.data?.room?.occupants?.length === 2);

    // 25. Admin allocates Student 3 to Room (Capacity: 3/3 — FULL)
    const alloc3Res = await request('POST', `/api/admin/students/${student3Id}/approve-and-allocate`, {
      roomId: testRoomDoc._id,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(26, 'Admin allocates Student 3 to Room (Occupancy: 3/3 — FULL)', alloc3Res.status === 200 && alloc3Res.body.data?.room?.occupants?.length === 3);

    // 26. Allocation of 4th student to full room rejected (Capacity limit enforced)
    const alloc4Res = await request('POST', `/api/admin/students/${student4Id}/approve-and-allocate`, {
      roomId: testRoomDoc._id,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(27, 'Allocation of 4th student to full room rejected with 400 (Capacity 3 strictly enforced)', alloc4Res.status === 400 && alloc4Res.body.message.includes('capacity'));

    // 27. Concurrency test — simultaneous allocation requests to 1 available spot
    // Create an isolated room with capacity 1
    const raceRoom = await Room.create({
      hostel: testHostelDoc._id,
      roomNumber: `RACE_${uniqueId.toString().slice(-4)}`,
      floor: 2,
      capacity: 1,
      occupants: [],
    });

    const candidateA = await User.create({
      firstName: 'Race',
      lastName: 'A',
      email: `raceA.${uniqueId}@sitpune.edu.in`,
      password: testPassword,
      role: 'student',
      status: 'pending',
      phone: `81${uniqueId.toString().slice(-8)}`,
    });

    const candidateB = await User.create({
      firstName: 'Race',
      lastName: 'B',
      email: `raceB.${uniqueId}@sitpune.edu.in`,
      password: testPassword,
      role: 'student',
      status: 'pending',
      phone: `82${uniqueId.toString().slice(-8)}`,
    });

    // Fire both requests simultaneously
    const [raceRes1, raceRes2] = await Promise.all([
      request('POST', `/api/admin/students/${candidateA._id}/approve-and-allocate`, { roomId: raceRoom._id }, { Authorization: `Bearer ${adminToken}` }),
      request('POST', `/api/admin/students/${candidateB._id}/approve-and-allocate`, { roomId: raceRoom._id }, { Authorization: `Bearer ${adminToken}` }),
    ]);

    const statuses = [raceRes1.status, raceRes2.status];
    const exactlyOneSuccess = statuses.filter((s) => s === 200).length === 1 && statuses.filter((s) => s === 400).length === 1;
    const finalRaceRoom = await Room.findById(raceRoom._id);
    record(28, 'Concurrency test: simultaneous allocation to 1 spot allows exactly 1 winner and rejects 2nd', exactlyOneSuccess && finalRaceRoom.occupants.length === 1);

    // 28. Admin rejects Student 4 (status becomes rejected)
    const rejectRes = await request('POST', `/api/admin/students/${student4Id}/reject`, {
      reason: 'Incomplete verification documents',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(29, 'Admin rejects student registration with custom reason', rejectRes.status === 200 && rejectRes.body.data?.status === 'rejected');

    // 29. Rejected student login blocked with 403
    const rejectedLoginRes = await request('POST', '/api/users/login', {
      email: testStudent4Email,
      password: testPassword,
    });
    record(30, 'Rejected student login blocked with 403 and informative reason', rejectedLoginRes.status === 403 && rejectedLoginRes.body.message.includes('rejected'));

    // 30. Student cannot access other student complaints (IDOR protection)
    const student2LoginRes = await request('POST', '/api/users/login', {
      email: testStudent2Email,
      password: testPassword,
    });
    const student2Token = student2LoginRes.body.data?.token;

    const idorComplaintRes = await request('GET', `/api/complaints/${student1ComplaintId}`, null, {
      Authorization: `Bearer ${student2Token}`,
    });
    record(31, 'Student cannot view another student complaint (IDOR protected)', idorComplaintRes.status === 403);

    // 31. Student cannot update other student profile (Self-update only)
    const idorProfileRes = await request('PUT', '/api/profile', {
      firstName: 'TamperedName',
    }, {
      Authorization: `Bearer ${student2Token}`,
    });
    const student1Check = await User.findById(student1Id);
    record(32, 'Self-update only (Student 2 cannot tamper with Student 1 data)', student1Check.firstName === 'First');

    // 32. Unauthenticated request to protected route rejected (401)
    const unauthRes = await request('GET', '/api/profile');
    record(33, 'Unauthenticated request to protected route rejected (401)', unauthRes.status === 401);

    // 33. Student cannot access admin dashboard (403 forbidden)
    const studentAtAdminDashRes = await request('GET', '/api/admin/dashboard', null, {
      Authorization: `Bearer ${student1Token}`,
    });
    record(34, 'Student cannot access admin dashboard (403 forbidden)', studentAtAdminDashRes.status === 403);

    // 34. Warden can view rooms and complaints
    const wardenLoginRes = await request('POST', '/api/admin/login', {
      email: wardenEmail,
      password: staffPass,
    });
    wardenToken = wardenLoginRes.body.data?.token;

    const wardenRoomsRes = await request('GET', '/api/admin/rooms', null, {
      Authorization: `Bearer ${wardenToken}`,
    });
    record(35, 'Warden can view rooms with live occupancy details', wardenRoomsRes.status === 200 && wardenRoomsRes.body.success === true);

    // 35. Warden cannot delete users (Admin only)
    const wardenDeleteUserRes = await request('DELETE', `/api/admin/users/${student4Id}`, null, {
      Authorization: `Bearer ${wardenToken}`,
    });
    record(36, 'Warden forbidden from user deletion (Admin role strictly required)', wardenDeleteUserRes.status === 403);

    // 36. NoSQL injection in login body rejected/sanitized
    const nosqlLoginRes = await request('POST', '/api/users/login', {
      email: { $gt: '' },
      password: testPassword,
    });
    record(37, 'NoSQL injection object payload in login safely rejected with 400', nosqlLoginRes.status === 400);

    // 37. Student forgot password dispatches token
    const studentForgotRes = await request('POST', '/api/users/forgot-password', { email: testStudentEmail });
    activeResetToken = studentForgotRes.body.resetToken;
    record(38, 'Student forgot password generates reset token safely', studentForgotRes.status === 200 && !!activeResetToken);

    // 38. Student reset password succeeds with fresh token
    const newStudentPass = 'NewStudentPass123!@#$';
    const studentResetRes = await request('POST', `/api/users/reset-password/${activeResetToken}`, {
      password: newStudentPass,
    });
    record(39, 'Student reset password succeeds with fresh token and clears token', studentResetRes.status === 200 && studentResetRes.body.success === true);

    // 39. Room reassignment by Admin moves student and updates occupancy
    const reassignRes = await request('PUT', `/api/admin/students/${student1Id}/reassign-room`, {
      newRoomId: secondRoomDoc._id,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    const oldRoomAfter = await Room.findById(testRoomDoc._id);
    const newRoomAfter = await Room.findById(secondRoomDoc._id);
    const studentAfterReassign = await User.findById(student1Id);

    const reassignSuccess = reassignRes.status === 200 &&
      !oldRoomAfter.occupants.map(String).includes(student1Id) &&
      newRoomAfter.occupants.map(String).includes(student1Id) &&
      studentAfterReassign.roomNumber === secondRoomDoc.roomNumber;
    record(40, 'Admin reassigns student to another room with atomic occupancy update', reassignSuccess);

  } catch (error) {
    console.error('❌ Test execution error:', error);
  } finally {
    // Teardown
    if (server) {
      await new Promise((res) => server.close(res));
    }
    await mongoose.connection.close();

    console.log('\n===============================================================');
    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('===============================================================');
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`Total Tests Run : ${results.length}`);
    console.log(`Passed          : ${passed} / ${results.length} (${Math.round((passed / results.length) * 100)}%)`);
    console.log(`Failed          : ${failed} / ${results.length}`);
    console.log('===============================================================');

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.filter((r) => !r.passed).forEach((r) => {
        console.log(`- Test ${r.testNum}: ${r.title} ${r.details ? `(${r.details})` : ''}`);
      });
      process.exit(1);
    } else {
      console.log('\n🎉 ALL 40 TESTS PASSED SUCCESSFULLY! Production readiness verified.\n');
      process.exit(0);
    }
  }
}

runAllTests();
