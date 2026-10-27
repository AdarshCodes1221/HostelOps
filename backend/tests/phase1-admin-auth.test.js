/**
 * Phase 1 Automated Verification Suite
 * Tests Admin Authentication, Authorization, Role Consistency,
 * Complaint Management, Token Validation, and Student Blocking.
 */

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = require('../server');
const connectDB = require('../config/database');
const User = require('../models/User');
const Complaint = require('../models/Complaint');

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

async function runPhase1Tests() {
  console.log('===============================================================');
  console.log('🛡️ RUNNING PHASE 1: ADMIN AUTH, DASHBOARD & COMPLAINTS TEST SUITE');
  console.log('===============================================================\n');

  await connectDB();

  server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`📡 Test server running on ${baseUrl}\n`);

  const unique = Date.now();
  const adminEmail = `p1.admin.${unique}@siu.edu.in`;
  const studentEmail = `p1.student.${unique}@sitpune.edu.in`;
  const password = 'StrongAdminPass123!@#';

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(password, salt);

    // 1. Create verified Admin and Student
    const adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'Tester',
      email: adminEmail,
      password: hashedPass,
      role: 'admin',
      status: 'approved',
      phone: `91${unique.toString().slice(-8)}`,
    });

    const studentUser = await User.create({
      firstName: 'Student',
      lastName: 'Tester',
      email: studentEmail,
      password: hashedPass,
      role: 'student',
      status: 'approved',
      prn: `P1PRN${unique.toString().slice(-6)}`,
      phone: `92${unique.toString().slice(-8)}`,
      roomNumber: '101',
      hostel: 'Voila',
      floor: '1',
    });

    // Create a sample complaint for testing
    const testComplaint = await Complaint.create({
      user: studentUser._id,
      title: 'Phase 1 Leaking Tap',
      description: 'Tap needs repair in Room 101',
      category: 'maintenance',
      hostel: 'Voila',
      roomNumber: '101',
      floor: '1',
      status: 'pending',
    });

    // Test 1: Admin login succeeds
    const adminLoginRes = await request('POST', '/api/admin/login', {
      email: adminEmail,
      password: password,
    });
    const adminToken = adminLoginRes.body.data?.token;
    record(1, 'Admin login with valid admin credentials succeeds', adminLoginRes.status === 200 && !!adminToken);

    // Test 2: Admin dashboard access works
    const adminDashRes = await request('GET', '/api/admin/dashboard', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(2, 'Admin accesses /api/admin/dashboard successfully', adminDashRes.status === 200 && adminDashRes.body.success === true);

    // Test 3: Admin complaint access returns all complaints
    const adminComplaintsRes = await request('GET', '/api/admin/complaints', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(3, 'Admin accesses /api/admin/complaints successfully', adminComplaintsRes.status === 200 && Array.isArray(adminComplaintsRes.body.data));

    // Test 4: Admin updates complaint status
    const updateComplaintRes = await request('PATCH', `/api/admin/complaints/${testComplaint._id}`, {
      status: 'in_progress',
      assignedDepartment: 'plumbing',
      adminNotes: 'Assigned to plumber Ramesh',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(4, 'Admin updates complaint status and notes successfully', updateComplaintRes.status === 200 && updateComplaintRes.body.data?.status === 'in_progress');

    // Test 5: Student login succeeds via student portal
    const studentLoginRes = await request('POST', '/api/users/login', {
      email: studentEmail,
      password: password,
    });
    const studentToken = studentLoginRes.body.data?.token;
    record(5, 'Student logs in successfully via student portal', studentLoginRes.status === 200 && !!studentToken);

    // Test 6: Student strictly forbidden from /api/admin/dashboard (403)
    const studentDashRes = await request('GET', '/api/admin/dashboard', null, {
      Authorization: `Bearer ${studentToken}`,
    });
    record(6, 'Student attempting /api/admin/dashboard is blocked with 403', studentDashRes.status === 403);

    // Test 7: Student strictly forbidden from /api/admin/complaints (403)
    const studentAdminComplaintsRes = await request('GET', '/api/admin/complaints', null, {
      Authorization: `Bearer ${studentToken}`,
    });
    record(7, 'Student attempting /api/admin/complaints is blocked with 403', studentAdminComplaintsRes.status === 403);

    // Test 8: Student strictly forbidden from /api/admin/login (403 barrier)
    const studentAdminLoginRes = await request('POST', '/api/admin/login', {
      email: studentEmail,
      password: password,
    });
    record(8, 'Student attempting admin portal login is blocked with 403', studentAdminLoginRes.status === 403);

    // Test 9: Admin token profile validation on refresh (/api/profile returns role=admin)
    const profileRes = await request('GET', '/api/profile', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(9, 'Admin profile validation on page refresh returns verified admin role', profileRes.status === 200 && profileRes.body.data?.role === 'admin');

    // Test 10: Invalid/expired token rejected with 401
    const invalidTokenRes = await request('GET', '/api/admin/dashboard', null, {
      Authorization: 'Bearer invalid.expired.token.here',
    });
    record(10, 'Invalid token to protected route is rejected with 401', invalidTokenRes.status === 401);

    // Cleanup
    await User.deleteMany({ _id: { $in: [adminUser._id, studentUser._id] } });
    await Complaint.deleteOne({ _id: testComplaint._id });

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    if (server) {
      await new Promise((res) => server.close(res));
    }
    await mongoose.connection.close();

    console.log('\n===============================================================');
    console.log('📊 PHASE 1 TEST SUMMARY');
    console.log('===============================================================');
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
    console.log('===============================================================\n');

    if (passed === total) {
      console.log('🎉 ALL PHASE 1 ADMIN AUTH & COMPLAINT TESTS PASSED!\n');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runPhase1Tests();
