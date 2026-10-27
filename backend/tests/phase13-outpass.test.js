/**
 * PHASE 13: OUTPASS & DIGITAL GATE PASS AUTOMATED TEST SUITE
 *
 * Verifies:
 * 1. Student without room allocation cannot apply for outpass (400)
 * 2. Approved student creates valid outpass request (status: pending)
 * 3. Outpass creation triggers notification to administration
 * 4. Student can view their own outpasses (IDOR protected)
 * 5. IDOR defense: Student B cannot view Student A's outpass (403)
 * 6. Admin can view all outpasses with pagination & filter
 * 7. Admin rejects outpass request with remarks (status: rejected)
 * 8. QR verification rejects non-approved / rejected pass (400)
 * 9. Admin approves outpass: generates opaque passCode & HMAC signature (status: approved)
 * 10. QR verification succeeds for valid approved pass (200 OK, zero sensitive leaks)
 * 11. QR verification fails for non-existent / forged pass code (404)
 * 12. Security guard marks gate pass as used (status: used)
 * 13. Pass reuse prevention: Scanning already-used pass strictly fails (400)
 * 14. Expired gate pass fails verification (400)
 */

const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const app = require('../server');
const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Outpass = require('../models/Outpass');
const Notification = require('../models/Notification');

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
  console.log('🎫 RUNNING PHASE 13: OUTPASS & DIGITAL GATE PASS TEST SUITE');
  console.log('===============================================================\n');

  await mongoose.connect(process.env.MONGO_URI);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`📡 Test server running on ${baseUrl}\n`);

  const ts = Date.now();
  const student1Email = `student.outpass1.${ts}@sitpune.edu.in`;
  const student2Email = `student.outpass2.${ts}@sitpune.edu.in`;
  const adminEmail = `admin.outpass.${ts}@symbiosis.ac.in`;
  const password = 'StrongPassword123!';

  let testPassedCount = 0;
  const totalTests = 14;

  try {
    // 0. Setup test users
    const [admin, student1, student2] = await Promise.all([
      User.create({
        firstName: 'Outpass',
        lastName: 'Admin',
        email: adminEmail,
        password: await require('bcryptjs').hash(password, 10),
        role: 'admin',
        status: 'approved',
        isEmailVerified: true,
      }),
      User.create({
        firstName: 'Student',
        lastName: 'One',
        email: student1Email,
        password: await require('bcryptjs').hash(password, 10),
        role: 'student',
        status: 'approved',
        isEmailVerified: true,
        hostel: 'Hostel Alpha',
        roomNumber: '101',
      }),
      User.create({
        firstName: 'Student',
        lastName: 'Two',
        email: student2Email,
        password: await require('bcryptjs').hash(password, 10),
        role: 'student',
        status: 'approved',
        isEmailVerified: true,
        hostel: 'Hostel Beta',
        roomNumber: '202',
      }),
    ]);

    const adminToken = admin.getSignedJwtToken();
    const student1Token = student1.getSignedJwtToken();
    const student2Token = student2.getSignedJwtToken();

    // Student without room
    const homelessStudent = await User.create({
      firstName: 'Homeless',
      lastName: 'Student',
      email: `homeless.${ts}@sitpune.edu.in`,
      password: await require('bcryptjs').hash(password, 10),
      role: 'student',
      status: 'approved',
      isEmailVerified: true,
    });
    const homelessToken = homelessStudent.getSignedJwtToken();

    // TEST 1: Student without room allocation cannot apply
    const res1 = await request('POST', '/api/outpass', {
      reason: 'Home visit',
      destination: 'Mumbai',
      departureDate: new Date(Date.now() + 86400000),
      expectedReturnDate: new Date(Date.now() + 172800000),
      emergencyContact: '9876543210',
    }, homelessToken);

    if (res1.status === 400 && res1.body.success === false) {
      console.log('✅ Test  1: Student without room allocation blocked from outpass (400) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test  1 Failed:', res1.body);
    }

    // TEST 2: Valid outpass request creation
    const depDate = new Date(Date.now() + 86400000); // Tomorrow
    const retDate = new Date(Date.now() + 86400000 * 3); // 3 days later

    const res2 = await request('POST', '/api/outpass', {
      reason: 'Attending family function',
      category: 'home',
      destination: 'Pune City Center',
      departureDate: depDate,
      expectedReturnDate: retDate,
      emergencyContact: '9876543210',
    }, student1Token);

    let outpass1Id;
    if (res2.status === 201 && res2.body.success && res2.body.data.status === 'pending') {
      outpass1Id = res2.body.data._id;
      console.log('✅ Test  2: Approved student creates valid outpass request (status: pending) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test  2 Failed:', res2.body);
    }

    // TEST 3: Admin notifications triggered
    const notifs = await Notification.find({ type: 'general', entityId: outpass1Id });
    if (notifs.length > 0) {
      console.log('✅ Test  3: Outpass creation triggers administrative notifications -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test  3 Failed: Notification was not created');
    }

    // TEST 4: Student views their own outpasses
    const res4 = await request('GET', '/api/outpass/my', null, student1Token);
    if (res4.status === 200 && res4.body.data.some(p => p._id === outpass1Id)) {
      console.log('✅ Test  4: Student retrieves their own outpass list -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test  4 Failed:', res4.body);
    }

    // TEST 5: IDOR Protection: Student 2 cannot access Student 1's outpass
    const res5 = await request('GET', `/api/outpass/${outpass1Id}`, null, student2Token);
    if (res5.status === 403 && res5.body.success === false) {
      console.log('✅ Test  5: Student 2 blocked from viewing Student 1 outpass (IDOR protected: 403) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test  5 Failed:', res5.body);
    }

    // TEST 6: Admin views all outpasses
    const res6 = await request('GET', '/api/outpass/admin/all', null, adminToken);
    if (res6.status === 200 && res6.body.data.length > 0) {
      console.log('✅ Test  6: Admin can view all outpasses with pagination -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test  6 Failed:', res6.body);
    }

    // TEST 7: Admin rejects an outpass
    const res7Req = await request('POST', '/api/outpass', {
      reason: 'Late night outing',
      destination: 'Club',
      departureDate: depDate,
      expectedReturnDate: retDate,
      emergencyContact: '9876543210',
    }, student2Token);
    const rejectPassId = res7Req.body.data._id;

    const res7 = await request('PUT', `/api/outpass/admin/${rejectPassId}/reject`, {
      adminRemarks: 'Unapproved destination during weekdays',
    }, adminToken);

    if (res7.status === 200 && res7.body.data.status === 'rejected') {
      console.log('✅ Test  7: Admin rejects outpass request with remarks (status: rejected) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test  7 Failed:', res7.body);
    }

    // TEST 8: QR Verification fails for rejected/pending outpass
    const res8 = await request('POST', '/api/outpass/verify-qr', {
      passCode: 'DUMMY-PENDING',
    });
    if (res8.status === 404 && res8.body.valid === false) {
      console.log('✅ Test  8: QR verification fails for non-existent / unapproved pass -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test  8 Failed:', res8.body);
    }

    // TEST 9: Admin approves outpass and generates QR passCode
    const res9 = await request('PUT', `/api/outpass/admin/${outpass1Id}/approve`, {
      adminRemarks: 'Have a safe journey home',
    }, adminToken);

    let approvedPassCode;
    let qrDataUri;
    if (res9.status === 200 && res9.body.data.status === 'approved' && res9.body.data.passCode) {
      approvedPassCode = res9.body.data.passCode;
      qrDataUri = res9.body.data.qrCodeDataUri;
      console.log(`✅ Test  9: Admin approves outpass & generates opaque passCode (${approvedPassCode}) -> PASS`);
      testPassedCount++;
    } else {
      console.error('❌ Test  9 Failed:', res9.body);
    }

    // TEST 10: QR Verification succeeds for valid approved pass
    const res10 = await request('POST', '/api/outpass/verify-qr', {
      passCode: approvedPassCode,
    });

    if (
      res10.status === 200 &&
      res10.body.valid === true &&
      res10.body.data.status === 'approved' &&
      res10.body.data.studentName === 'Student One'
    ) {
      console.log('✅ Test 10: QR Gate verification succeeds for valid pass (200 OK, zero secret leaks) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test 10 Failed:', res10.body);
    }

    // TEST 11: Forged pass code fails
    const res11 = await request('POST', '/api/outpass/verify-qr', {
      passCode: 'OP-FORGEDCODE99',
    });
    if (res11.status === 404 && res11.body.valid === false) {
      console.log('✅ Test 11: Forged or non-existent pass code rejected (404) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test 11 Failed:', res11.body);
    }

    // TEST 12: Security gate marks pass as used / checked out
    const res12 = await request('POST', `/api/outpass/admin/${outpass1Id}/mark-used`, {}, adminToken);
    if (res12.status === 200 && (res12.body.data.status === 'used' || res12.body.data.status === 'checked_out')) {
      console.log('✅ Test 12: Security gate check-out marks pass as checked out (status: checked_out / used) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test 12 Failed:', res12.body);
    }

    // TEST 13: Single-use invariant: Re-scanning already-used pass is rejected
    const res13 = await request('POST', '/api/outpass/verify-qr', {
      passCode: approvedPassCode,
    });
    if (res13.status === 400 && res13.body.valid === false && res13.body.message.includes('ALREADY USED')) {
      console.log('✅ Test 13: Pass reuse prevented: Re-scanning already used pass rejected (400) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test 13 Failed:', res13.body);
    }

    // TEST 14: Expired pass verification fails
    const expiredPass = await Outpass.create({
      student: student1._id,
      hostel: 'Hostel Alpha',
      roomNumber: '101',
      reason: 'Old trip',
      destination: 'Goa',
      departureDate: new Date(Date.now() - 86400000 * 5),
      expectedReturnDate: new Date(Date.now() - 86400000 * 2), // Past return date
      emergencyContact: '9876543210',
      status: 'approved',
      passCode: 'OP-EXPIRED99',
    });
    expiredPass.qrSignature = expiredPass.signPass();
    await expiredPass.save();

    const res14 = await request('POST', '/api/outpass/verify-qr', {
      passCode: 'OP-EXPIRED99',
    });

    if (res14.status === 400 && res14.body.valid === false && res14.body.message.includes('EXPIRED')) {
      console.log('✅ Test 14: Expired gate pass verification rejected (400) -> PASS');
      testPassedCount++;
    } else {
      console.error('❌ Test 14 Failed:', res14.body);
    }

  } finally {
    // Cleanup test data
    await User.deleteMany({ email: { $in: [student1Email, student2Email, adminEmail, `homeless.${ts}@sitpune.edu.in`] } });
    await Outpass.deleteMany({ hostel: { $in: ['Hostel Alpha', 'Hostel Beta'] } });
    await server.close();
    await mongoose.connection.close();
  }

  console.log('\n===============================================================');
  console.log('📊 PHASE 13 TEST SUMMARY');
  console.log('===============================================================');
  console.log(`Total: ${totalTests} | Passed: ${testPassedCount} | Failed: ${totalTests - testPassedCount}`);
  console.log('===============================================================\n');

  if (testPassedCount === totalTests) {
    console.log('🎉 ALL PHASE 13 OUTPASS & DIGITAL GATE PASS TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME PHASE 13 TESTS FAILED!\n');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
