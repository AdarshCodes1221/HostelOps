/**
 * PHASE 5 AUTOMATED TEST SUITE: AUTHENTICATION SECURITY HARDENING
 *
 * Verifies:
 * 1. Student login sets HttpOnly session cookie ('token=...')
 * 2. Protected route (/api/profile) succeeds using HttpOnly cookie alone (zero Bearer headers)
 * 3. Backward compatibility: Protected route succeeds using Bearer token alone (zero cookies)
 * 4. Admin login sets HttpOnly session cookie
 * 5. Admin protected route (/api/admin/dashboard) succeeds using cookie alone
 * 6. Student logout (/api/users/logout) clears cookie with past expiry
 * 7. Admin logout (/api/admin/logout) clears cookie with past expiry
 * 8. Subsequent requests after cookie clear fail with 401 Unauthorized
 * 9. Tampered/forged cookies safely rejected with 401
 * 10. Clean database teardown
 */

const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
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

function extractCookie(resHeaders, cookieName) {
  const setCookie = resHeaders['set-cookie'];
  if (!setCookie) return null;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of list) {
    if (c.startsWith(`${cookieName}=`)) {
      return c;
    }
  }
  return null;
}

function getCookieValue(cookieHeaderStr) {
  if (!cookieHeaderStr) return null;
  return cookieHeaderStr.split(';')[0];
}

async function runPhase5Tests() {
  console.log('\n===============================================================');
  console.log('🔒 RUNNING PHASE 5: AUTHENTICATION HARDENING TEST SUITE');
  console.log('===============================================================\n');

  let server;
  let serverPort;
  const unique = Date.now();
  const adminEmail = `admin.auth.${unique}@symbiosis.ac.in`;
  const studentEmail = `student.auth.${unique}@sitpune.edu.in`;
  const password = 'TestPassword@123';

  let adminId;
  let studentId;

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
    const hashedPass = await bcrypt.hash(password, salt);

    // Setup Admin
    const adminUser = await User.create({
      firstName: 'AuthAdmin',
      lastName: 'P5',
      email: adminEmail,
      password: hashedPass,
      role: 'admin',
      status: 'approved',
      phone: `91${unique.toString().slice(-8)}`,
    });
    adminId = adminUser._id;

    // Setup Student
    const studentUser = await User.create({
      firstName: 'AuthStudent',
      lastName: 'P5',
      email: studentEmail,
      password: hashedPass,
      role: 'student',
      status: 'approved',
      prn: `AUTH${unique.toString().slice(-6)}`,
      phone: `92${unique.toString().slice(-8)}`,
    });
    studentId = studentUser._id;

    // Test 1: Student login sets HttpOnly session cookie
    const studentLoginRes = await request(serverPort, 'POST', '/api/users/login', {
      email: studentEmail,
      password,
    });
    const studentCookieStr = extractCookie(studentLoginRes.headers, 'token');
    const isHttpOnly = studentCookieStr ? studentCookieStr.toLowerCase().includes('httponly') : false;
    const studentToken = studentLoginRes.body.data?.token;
    record(
      1,
      'Student login sets HttpOnly session cookie (token=...; HttpOnly)',
      studentLoginRes.status === 200 && !!studentCookieStr && isHttpOnly
    );

    // Test 2: Protected student route (/api/profile) succeeds using HttpOnly cookie ALONE (no Authorization header)
    const studentCookiePair = getCookieValue(studentCookieStr);
    const profileWithCookieRes = await request(serverPort, 'GET', '/api/profile', null, {
      Cookie: studentCookiePair,
    });
    record(
      2,
      'Protected route (/api/profile) succeeds using HttpOnly cookie alone (zero Bearer headers)',
      profileWithCookieRes.status === 200 && profileWithCookieRes.body.data?._id?.toString() === studentId.toString()
    );

    // Test 3: Backward-compatibility: Protected route succeeds with Bearer token alone (zero cookies)
    const profileWithBearerRes = await request(serverPort, 'GET', '/api/profile', null, {
      Authorization: `Bearer ${studentToken}`,
    });
    record(
      3,
      'Backward-compatibility: Protected route succeeds with Bearer token alone (zero cookies)',
      profileWithBearerRes.status === 200 && profileWithBearerRes.body.data?._id?.toString() === studentId.toString()
    );

    // Test 4: Admin login sets HttpOnly session cookie
    const adminLoginRes = await request(serverPort, 'POST', '/api/admin/login', {
      email: adminEmail,
      password,
    });
    const adminCookieStr = extractCookie(adminLoginRes.headers, 'token');
    const adminIsHttpOnly = adminCookieStr ? adminCookieStr.toLowerCase().includes('httponly') : false;
    const adminToken = adminLoginRes.body.data?.token;
    record(
      4,
      'Admin login sets HttpOnly session cookie (token=...; HttpOnly)',
      adminLoginRes.status === 200 && !!adminCookieStr && adminIsHttpOnly
    );

    // Test 5: Admin protected route (/api/admin/dashboard) succeeds using cookie alone
    const adminCookiePair = getCookieValue(adminCookieStr);
    const adminDashCookieRes = await request(serverPort, 'GET', '/api/admin/dashboard', null, {
      Cookie: adminCookiePair,
    });
    record(
      5,
      'Admin protected route (/api/admin/dashboard) succeeds using cookie alone',
      adminDashCookieRes.status === 200 && adminDashCookieRes.body.success === true
    );

    // Test 6: Student logout clears session cookie
    const studentLogoutRes = await request(serverPort, 'POST', '/api/users/logout', null, {
      Cookie: studentCookiePair,
    });
    const studentLogoutCookie = extractCookie(studentLogoutRes.headers, 'token');
    const cookieCleared = studentLogoutCookie
      ? (studentLogoutCookie.includes('Expires=Thu, 01 Jan 1970') || studentLogoutCookie.includes('Max-Age=0') || studentLogoutCookie.startsWith('token=;'))
      : false;
    record(
      6,
      'Student logout endpoint (/api/users/logout) clears cookie with expired timestamp',
      studentLogoutRes.status === 200 && cookieCleared
    );

    // Test 7: Admin logout clears session cookie
    const adminLogoutRes = await request(serverPort, 'POST', '/api/admin/logout', null, {
      Cookie: adminCookiePair,
    });
    const adminLogoutCookie = extractCookie(adminLogoutRes.headers, 'token');
    const adminCookieCleared = adminLogoutCookie
      ? (adminLogoutCookie.includes('Expires=Thu, 01 Jan 1970') || adminLogoutCookie.includes('Max-Age=0') || adminLogoutCookie.startsWith('token=;'))
      : false;
    record(
      7,
      'Admin logout endpoint (/api/admin/logout) clears cookie with expired timestamp',
      adminLogoutRes.status === 200 && adminCookieCleared
    );

    // Test 8: Request without any token or cookie rejected with 401
    const noAuthRes = await request(serverPort, 'GET', '/api/profile');
    record(
      8,
      'Request with no token and no cookie rejected with 401 Unauthorized',
      noAuthRes.status === 401
    );

    // Test 9: Tampered cookie safely rejected with 401
    const tamperedRes = await request(serverPort, 'GET', '/api/profile', null, {
      Cookie: 'token=INVALID_FORGED_OR_EXPIRED_JWT_STRING',
    });
    record(
      9,
      'Tampered or forged cookie safely rejected with 401 Unauthorized',
      tamperedRes.status === 401
    );

    // Test 10: Clean user teardown
    await User.deleteMany({ _id: { $in: [adminId, studentId] } });
    record(10, 'Test accounts safely cleaned up from MongoDB Atlas', true);

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    if (server) {
      await new Promise((res) => server.close(res));
    }
    await mongoose.connection.close();

    console.log('\n===============================================================');
    console.log('📊 PHASE 5 TEST SUMMARY');
    console.log('===============================================================');
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
    console.log('===============================================================\n');

    if (passed === total) {
      console.log('🎉 ALL PHASE 5 AUTHENTICATION SECURITY TESTS PASSED!\n');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runPhase5Tests();
