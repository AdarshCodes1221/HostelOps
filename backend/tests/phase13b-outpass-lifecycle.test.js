/**
 * PHASE 13B: ADVANCED OUTPASS & LEAVE LIFECYCLE (RETURN, OVERDUE, ATTENDANCE, STATS)
 */

const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = require('../server');
const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Outpass = require('../models/Outpass');

let server;
let baseUrl;

const request = (method, path, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

async function runTests() {
  console.log('\n===============================================================');
  console.log('🔄 RUNNING PHASE 13B: COMPLETE OUTPASS LIFECYCLE & RETURN TESTS');
  console.log('===============================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  const ts = Date.now();
  const studentEmail = `student.lifecycle.${ts}@sitpune.edu.in`;
  const adminEmail = `admin.lifecycle.${ts}@symbiosis.ac.in`;
  const securityEmail = `security.gate.${ts}@symbiosis.ac.in`;
  const password = 'StrongPassword123!';

  let testPassedCount = 0;
  const totalTests = 7;

  try {
    const [admin, security, student] = await Promise.all([
      User.create({
        firstName: 'Admin',
        lastName: 'Officer',
        email: adminEmail,
        password: await require('bcryptjs').hash(password, 10),
        role: 'admin',
        status: 'approved',
      }),
      User.create({
        firstName: 'Gate',
        lastName: 'Security',
        email: securityEmail,
        password: await require('bcryptjs').hash(password, 10),
        role: 'security',
        status: 'approved',
      }),
      User.create({
        firstName: 'Rohan',
        lastName: 'Sharma',
        email: studentEmail,
        prn: `2107012299${ts.toString().slice(-4)}`,
        password: await require('bcryptjs').hash(password, 10),
        role: 'student',
        hostel: 'Hostel Alpha',
        roomNumber: '204',
        status: 'approved',
        isEmailVerified: true,
      }),
    ]);

    const adminToken = admin.getSignedJwtToken();
    const securityToken = security.getSignedJwtToken();
    const studentToken = student.getSignedJwtToken();

    // 1. Student creates outpass
    const res1 = await request('POST', '/api/outpass', {
      reason: 'Weekend Home Visit',
      category: 'home',
      destination: 'Pune Railway Station',
      departureDate: new Date(Date.now() + 3600000),
      expectedReturnDate: new Date(Date.now() + 86400000),
      emergencyContact: '9876543210',
    }, studentToken);

    let outpassId;
    if (res1.status === 201 && res1.body.data.status === 'pending') {
      outpassId = res1.body.data._id;
      console.log('✅ Test 1: Student creates outpass (status: pending) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test 1 Failed:', res1.body);
    }

    // 2. Admin approves outpass
    const res2 = await request('PUT', `/api/outpass/admin/${outpassId}/approve`, {
      adminRemarks: 'Approved for departure',
    }, adminToken);

    let passCode;
    if (res2.status === 200 && res2.body.data.status === 'approved' && res2.body.data.passCode) {
      passCode = res2.body.data.passCode;
      console.log(`✅ Test 2: Admin approves outpass (status: approved, code: ${passCode}) -> PASS`);
      testPassedCount++;
    } else {
      console.error('❌ Test 2 Failed:', res2.body);
    }

    // 3. Student views own outpass: sees APPROVED (not pending!)
    const res3 = await request('GET', '/api/outpass/my', null, studentToken);
    const studentRecord = res3.body.data.find(p => p._id === outpassId);
    if (res3.status === 200 && studentRecord && studentRecord.status === 'approved' && studentRecord.qrCodeDataUri) {
      console.log('✅ Test 3: Student sees authoritative APPROVED status with QR pass -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test 3 Failed: Student status synchronization bug:', studentRecord);
    }

    // 4. Security checks out student at gate
    const res4 = await request('POST', '/api/outpass/checkout', { passCode }, securityToken);
    if (res4.status === 200 && res4.body.data.status === 'checked_out' && res4.body.data.checkedOutAt) {
      console.log('✅ Test 4: Security executes checkout at gate (status: checked_out) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test 4 Failed:', res4.body);
    }

    // 5. Admin stats reflect student is CURRENTLY OUT
    const res5 = await request('GET', '/api/outpass/admin/stats', null, adminToken);
    if (res5.status === 200 && res5.body.data.currentlyOut >= 1) {
      console.log(`✅ Test 5: Admin dashboard statistics show currentlyOut = ${res5.body.data.currentlyOut} -> PASS`);
      testPassedCount++;
    } else {
      console.error('❌ Test 5 Failed:', res5.body);
    }

    // 6. Security records student Return at gate
    const res6 = await request('POST', '/api/outpass/return', { passCode }, securityToken);
    if (res6.status === 200 && res6.body.data.status === 'returned' && res6.body.data.returnedAt) {
      console.log('✅ Test 6: Security records student return (status: returned) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test 6 Failed:', res6.body);
    }

    // 7. Student refreshes: sees RETURNED (gate pass closed)
    const res7 = await request('GET', '/api/outpass/my', null, studentToken);
    const returnedRecord = res7.body.data.find(p => p._id === outpassId);
    if (res7.status === 200 && returnedRecord && returnedRecord.status === 'returned') {
      console.log('✅ Test 7: Student sees updated RETURNED status after gate re-entry -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test 7 Failed:', returnedRecord);
    }

    // Clean up
    await Promise.all([
      User.deleteMany({ _id: { $in: [admin._id, security._id, student._id] } }),
      Outpass.deleteMany({ _id: outpassId }),
    ]);

  } catch (err) {
    console.error('Phase 13B Test Error:', err);
  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  console.log(`📊 PHASE 13B TEST SUMMARY: ${testPassedCount}/${totalTests} Passed`);
  console.log('===============================================================\n');

  if (testPassedCount !== totalTests) {
    process.exit(1);
  }
}

runTests();
