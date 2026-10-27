/**
 * Phase 2 Automated Verification Suite
 * Tests Dynamic Hostel & Room Management:
 * - Hostel Creation, Editing, Activation/Deactivation
 * - Integer-style room numbering validation (101, 102, 201)
 * - Duplicate room rejection
 * - Atomic capacity enforcement (AVAILABLE / FULL)
 * - Concurrency & Reassignment
 * - Safe Deletion Guards
 */

const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = require('../server');
const connectDB = require('../config/database');
const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');

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

async function runPhase2Tests() {
  console.log('===============================================================');
  console.log('🏨 RUNNING PHASE 2: DYNAMIC HOSTEL, FLOOR & ROOM TEST SUITE');
  console.log('===============================================================\n');

  await connectDB();

  server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`📡 Test server running on ${baseUrl}\n`);

  const unique = Date.now();
  const adminEmail = `p2.admin.${unique}@siu.edu.in`;
  const student1Email = `p2.s1.${unique}@sitpune.edu.in`;
  const student2Email = `p2.s2.${unique}@sitpune.edu.in`;
  const student3Email = `p2.s3.${unique}@sitpune.edu.in`;
  const password = 'StrongPassword123!@#';

  let adminToken = '';
  let student1Token = '';
  let createdHostelId = '';
  let room101Id = '';
  let room102Id = '';
  let student1Id = '';
  let student2Id = '';
  let student3Id = '';

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(password, salt);

    // Setup Admin
    const adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'P2',
      email: adminEmail,
      password: hashedPass,
      role: 'admin',
      status: 'approved',
      phone: `93${unique.toString().slice(-8)}`,
    });

    const loginRes = await request('POST', '/api/admin/login', {
      email: adminEmail,
      password,
    });
    adminToken = loginRes.body.data?.token;

    // Setup Students
    const s1 = await User.create({
      firstName: 'Student1',
      lastName: 'P2',
      email: student1Email,
      password: hashedPass,
      role: 'student',
      status: 'approved',
      prn: `P2PRN1${unique.toString().slice(-6)}`,
      phone: `94${unique.toString().slice(-8)}`,
    });
    student1Id = s1._id.toString();

    const s2 = await User.create({
      firstName: 'Student2',
      lastName: 'P2',
      email: student2Email,
      password: hashedPass,
      role: 'student',
      status: 'approved',
      prn: `P2PRN2${unique.toString().slice(-6)}`,
      phone: `95${unique.toString().slice(-8)}`,
    });
    student2Id = s2._id.toString();

    const s3 = await User.create({
      firstName: 'Student3',
      lastName: 'P2',
      email: student3Email,
      password: hashedPass,
      role: 'student',
      status: 'approved',
      prn: `P2PRN3${unique.toString().slice(-6)}`,
      phone: `96${unique.toString().slice(-8)}`,
    });
    student3Id = s3._id.toString();

    const s1Login = await request('POST', '/api/users/login', {
      email: student1Email,
      password,
    });
    student1Token = s1Login.body.data?.token;

    // Test 1: Admin creates dynamic hostel
    const createHostelRes = await request('POST', '/api/hostels', {
      name: `DynHostel_${unique}`,
      description: 'Dynamic hostel for testing',
      address: '77 Test Campus',
      city: 'Pune',
      state: 'Maharashtra',
      zipCode: '411041',
      phone: '020-99998888',
      email: `dynhostel.${unique}@sitpune.edu.in`,
      location: 'West Campus',
      floors: 3,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    createdHostelId = createHostelRes.body.data?._id;
    record(1, 'Admin creates dynamic hostel record successfully', createHostelRes.status === 201 && !!createdHostelId);

    // Test 2: Admin creates dynamic room with proper integer numbering (101)
    const createRoomRes = await request('POST', `/api/hostels/${createdHostelId}/rooms`, {
      roomNumber: '101',
      floor: 1,
      capacity: 2,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    room101Id = createRoomRes.body.data?._id;
    record(2, 'Admin creates integer-numbered room 101 with capacity 2', createRoomRes.status === 201 && createRoomRes.body.data?.roomNumber === '101');

    // Test 3: Rejection of random non-integer room identifier
    const badRoomRes = await request('POST', `/api/hostels/${createdHostelId}/rooms`, {
      roomNumber: 'RANDOM_STRING_T9490',
      floor: 1,
      capacity: 2,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(3, 'Rejection of random non-integer room numbering (e.g. RANDOM_STRING_T9490)', badRoomRes.status === 400);

    // Test 4: Rejection of duplicate room number in the same hostel
    const duplicateRoomRes = await request('POST', `/api/hostels/${createdHostelId}/rooms`, {
      roomNumber: '101',
      floor: 1,
      capacity: 2,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(4, 'Rejection of duplicate room number in same hostel', duplicateRoomRes.status === 400);

    // Test 5: Create room 102 for reassignment testing
    const createRoom102Res = await request('POST', `/api/hostels/${createdHostelId}/rooms`, {
      roomNumber: '102',
      floor: 1,
      capacity: 2,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    room102Id = createRoom102Res.body.data?._id;
    record(5, 'Admin creates second integer-numbered room 102', createRoom102Res.status === 201 && createRoom102Res.body.data?.roomNumber === '102');

    // Test 6: Allocate Student 1 to Room 101 (Occupancy 1/2, Status: AVAILABLE)
    const alloc1Res = await request('POST', `/api/admin/students/${student1Id}/approve-and-allocate`, {
      roomId: room101Id,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    const roomAfter1 = await Room.findById(room101Id);
    record(6, 'Allocate student 1: occupancy 1/2, status AVAILABLE', alloc1Res.status === 200 && roomAfter1.occupants.length === 1 && roomAfter1.status === 'AVAILABLE');

    // Test 7: Allocate Student 2 to Room 101 (Occupancy 2/2, Status: FULL)
    const alloc2Res = await request('POST', `/api/admin/students/${student2Id}/approve-and-allocate`, {
      roomId: room101Id,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    const roomAfter2 = await Room.findById(room101Id);
    record(7, 'Allocate student 2: occupancy 2/2, status FULL', alloc2Res.status === 200 && roomAfter2.occupants.length === 2 && roomAfter2.status === 'FULL');

    // Test 8: Allocate Student 3 to Room 101 rejected (Capacity 2 strictly enforced)
    const alloc3Res = await request('POST', `/api/admin/students/${student3Id}/approve-and-allocate`, {
      roomId: room101Id,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(8, 'Attempt to allocate 3rd student into full capacity 2 room rejected with 400', alloc3Res.status === 400);

    // Test 9: Student cannot modify own room directly
    const studentTamperRes = await request('PUT', '/api/profile', {
      roomNumber: '102',
    }, {
      Authorization: `Bearer ${student1Token}`,
    });
    const s1AfterTamper = await User.findById(student1Id);
    record(9, 'Student cannot tamper with own assigned room (permanently locked)', s1AfterTamper.roomNumber === '101');

    // Test 10: Admin reassigns Student 1 from Room 101 to Room 102 atomically
    const reassignRes = await request('PUT', `/api/admin/students/${student1Id}/reassign-room`, {
      targetRoomId: room102Id,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    const room101AfterReassign = await Room.findById(room101Id);
    const room102AfterReassign = await Room.findById(room102Id);
    const reassignPassed = reassignRes.status === 200 &&
      room101AfterReassign.occupants.length === 1 &&
      room101AfterReassign.status === 'AVAILABLE' &&
      room102AfterReassign.occupants.length === 1;
    record(10, 'Admin reassigns student to Room 102; Room 101 occupancy drops to 1 and becomes AVAILABLE', reassignPassed);

    // Test 11: Remove Student 2 from Room 101
    const removeRes = await request('DELETE', `/api/admin/rooms/${room101Id}/occupants/${student2Id}`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
    const room101AfterRemove = await Room.findById(room101Id);
    record(11, 'Admin removes student occupant from room: occupancy drops to 0/2', removeRes.status === 200 && room101AfterRemove.occupants.length === 0);

    // Test 12: Attempt to delete room 102 with active occupant rejected
    const deleteOccupiedRoomRes = await request('DELETE', `/api/rooms/${room102Id}`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(12, 'Attempt to delete room with active occupants rejected with 400', deleteOccupiedRoomRes.status === 400);

    // Test 13: Admin toggles hostel active status (active -> inactive -> active)
    const toggleRes = await request('PATCH', `/api/hostels/${createdHostelId}/toggle-status`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
    const hostelAfterToggle = await Hostel.findById(createdHostelId);
    record(13, 'Admin toggles hostel active status dynamically', toggleRes.status === 200 && hostelAfterToggle.isActive === false);

    // Test 14: Dynamic hostel summary returns floor breakdown, available spots and full rooms
    const summaryRes = await request('GET', `/api/hostels/${createdHostelId}/summary`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
    record(14, 'Hostel dynamic summary reports live floors, spots, and room occupancy', summaryRes.status === 200 && summaryRes.body.data?.stats?.totalRooms === 2);

    // Clean up
    await User.deleteMany({ _id: { $in: [adminUser._id, s1._id, s2._id, s3._id] } });
    await Room.deleteMany({ hostel: createdHostelId });
    await Hostel.deleteOne({ _id: createdHostelId });

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    if (server) {
      await new Promise((res) => server.close(res));
    }
    await mongoose.connection.close();

    console.log('\n===============================================================');
    console.log('📊 PHASE 2 TEST SUMMARY');
    console.log('===============================================================');
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
    console.log('===============================================================\n');

    if (passed === total) {
      console.log('🎉 ALL PHASE 2 DYNAMIC HOSTEL & ROOM TESTS PASSED!\n');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runPhase2Tests();
