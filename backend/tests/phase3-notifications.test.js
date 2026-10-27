/**
 * Phase 3 Automated Verification Suite
 * Tests Notification Lifecycle:
 * - Event-triggered Notifications (Registration, Complaints, Room Change, Allocation)
 * - Admin Role Broadcasts vs Student Notification Isolation
 * - Unread Counter Accuracy
 * - Individual and Bulk Mark-All-Read Actions
 */

const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = require('../server');
const connectDB = require('../config/database');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const Room = require('../models/Room');
const Hostel = require('../models/Hostel');

let server;
let baseUrl;

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

const results = [];
function record(testNum, title, passed, details = '') {
  const status = passed ? 'PASS' : 'FAIL';
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} Test ${testNum.toString().padStart(2, ' ')}: ${title} -> ${status} ${details ? `(${details})` : ''}`);
  results.push({ testNum, title, passed, details });
}

async function runPhase3Tests() {
  console.log('===============================================================');
  console.log('🔔 RUNNING PHASE 3: PERSISTENT NOTIFICATIONS TEST SUITE');
  console.log('===============================================================\n');

  await connectDB();

  server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`📡 Test server running on ${baseUrl}\n`);

  const unique = Date.now();
  const adminEmail = `p3.admin.${unique}@siu.edu.in`;
  const studentEmail = `p3.student.${unique}@sitpune.edu.in`;
  const studentPrn = `P3PRN${unique.toString().slice(-6)}`;
  const password = 'StrongPassword123!@#';

  let adminToken = '';
  let studentToken = '';
  let studentId = '';
  let registeredUser;
  let testHostel;
  let testRoom;
  let createdComplaintId;

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(password, salt);

    // Setup Admin
    const adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'P3',
      email: adminEmail,
      password: hashedPass,
      role: 'admin',
      status: 'approved',
      phone: `91${unique.toString().slice(-8)}`,
    });

    const adminLoginRes = await request('POST', '/api/admin/login', {
      email: adminEmail,
      password,
    });
    adminToken = adminLoginRes.body.data?.token;

    // Test 1: Student registration automatically dispatches an admin notification
    const regRes = await request('POST', '/api/users/register', {
      firstName: 'Notify',
      lastName: 'Student',
      email: studentEmail,
      password,
      prn: studentPrn,
      phone: `92${unique.toString().slice(-8)}`,
    });
    studentId = regRes.body.data?._id;

    const regNotification = await Notification.findOne({
      recipientRole: 'admin',
      type: 'registration',
      entityId: studentId,
    });
    record(1, 'Student registration creates persistent admin notification (type: registration)', regRes.status === 201 && !!regNotification);

    // Setup a dynamic hostel and room for complaint & allocation tests
    testHostel = await Hostel.create({
      name: `HostelP3_${unique}`,
      description: 'Hostel for Phase 3',
      address: 'Pune Campus',
      city: 'Pune',
      state: 'Maharashtra',
      zipCode: '411001',
      phone: '020-11223344',
      email: `hostelp3.${unique}@sitpune.edu.in`,
      location: 'East',
      floors: 2,
    });

    testRoom = await Room.create({
      hostel: testHostel._id,
      roomNumber: '201',
      floor: 2,
      capacity: 2,
      occupants: [],
      status: 'AVAILABLE',
    });

    // Test 2: Admin allocates student -> creates student notification
    const allocRes = await request('POST', `/api/admin/students/${studentId}/approve-and-allocate`, {
      roomId: testRoom._id,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    const allocNotification = await Notification.findOne({
      userId: studentId,
      type: 'allocation',
    });
    record(2, 'Room allocation dispatches notification to student (type: allocation)', allocRes.status === 200 && !!allocNotification);

    // Login approved student
    const studentLoginRes = await request('POST', '/api/users/login', {
      email: studentEmail,
      password,
    });
    studentToken = studentLoginRes.body.data?.token;

    // Test 3: Student creates complaint -> creates admin notification
    const complaintRes = await request('POST', '/api/complaints', {
      title: 'Fan vibrating loudly',
      description: 'The ceiling fan has a loose screw.',
      category: 'electrical',
    }, {
      Authorization: `Bearer ${studentToken}`,
    });
    createdComplaintId = complaintRes.body.data?._id;

    const complaintNotification = await Notification.findOne({
      recipientRole: 'admin',
      type: 'complaint',
      entityId: createdComplaintId,
    });
    record(3, 'Filing complaint dispatches notification to administrators (type: complaint)', complaintRes.status === 201 && !!complaintNotification);

    // Test 4: Admin updates complaint status -> creates student notification
    const updateComplaintRes = await request('PATCH', `/api/admin/complaints/${createdComplaintId}`, {
      status: 'in_progress',
      assignedDepartment: 'electrical',
      adminNotes: 'Electrician appointed',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    const complaintUpdateNotification = await Notification.findOne({
      userId: studentId,
      entityId: createdComplaintId,
    });
    record(4, 'Admin updating complaint dispatches status update notification to student', updateComplaintRes.status === 200 && !!complaintUpdateNotification);

    // Test 5: Admin unread notification counter endpoint
    const adminUnreadRes = await request('GET', '/api/notifications/unread-count', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(5, 'Admin unread notification counter returns accurate unread count (>0)', adminUnreadRes.status === 200 && adminUnreadRes.body.unreadCount > 0);

    // Test 6: Admin fetches notifications list
    const adminNotifsRes = await request('GET', '/api/notifications/my', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(6, 'Admin retrieves active notifications list with unread flags', adminNotifsRes.status === 200 && Array.isArray(adminNotifsRes.body.data) && adminNotifsRes.body.data.length >= 2);

    // Test 7: Student notifications are strictly isolated (Student does not see admin registrations/internal alerts)
    const studentNotifsRes = await request('GET', '/api/notifications/my', null, {
      Authorization: `Bearer ${studentToken}`,
    });
    const hasAdminOnlyNotifs = studentNotifsRes.body.data.some(n => n.type === 'registration');
    record(7, 'Student notification feed strictly excludes internal admin registration alerts', studentNotifsRes.status === 200 && !hasAdminOnlyNotifs);

    // Test 8: Mark individual notification as read
    const targetNotifId = studentNotifsRes.body.data[0]._id;
    const markReadRes = await request('PUT', `/api/notifications/${targetNotifId}/read`, null, {
      Authorization: `Bearer ${studentToken}`,
    });
    record(8, 'Mark individual notification as read succeeds', markReadRes.status === 200 && markReadRes.body.data?.read === true);

    // Test 9: Mark all notifications as read
    const markAllReadRes = await request('PUT', '/api/notifications/mark-all-read', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    const adminUnreadAfterAll = await request('GET', '/api/notifications/unread-count', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(9, 'Mark all notifications as read resets unread counter to 0', markAllReadRes.status === 200 && adminUnreadAfterAll.body.unreadCount === 0);

    // Clean up
    await User.deleteMany({ _id: { $in: [adminUser._id, studentId] } });
    await Notification.deleteMany({
      $or: [{ userId: studentId }, { entityId: { $in: [studentId, createdComplaintId] } }],
    });
    await Complaint.deleteOne({ _id: createdComplaintId });
    await Room.deleteOne({ _id: testRoom._id });
    await Hostel.deleteOne({ _id: testHostel._id });

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    if (server) {
      await new Promise((res) => server.close(res));
    }
    await mongoose.connection.close();

    console.log('\n===============================================================');
    console.log('📊 PHASE 3 TEST SUMMARY');
    console.log('===============================================================');
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
    console.log('===============================================================\n');

    if (passed === total) {
      console.log('🎉 ALL PHASE 3 NOTIFICATION TESTS PASSED!\n');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runPhase3Tests();
