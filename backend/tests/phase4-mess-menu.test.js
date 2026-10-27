/**
 * PHASE 4 AUTOMATED TEST SUITE: MESS MENU END-TO-END
 *
 * Verifies:
 * 1. Public retrieval of menus (empty state & populated state)
 * 2. Dedicated /api/mess-menu/latest endpoint
 * 3. Security guards: Unauthenticated upload blocked (401)
 * 4. Security guards: Student role upload blocked (403)
 * 5. Admin upload of valid PNG image buffer (multipart/form-data)
 * 6. Image persistence in uploads/mess-menu/ on disk
 * 7. Correct weekStartDate persistence in database
 * 8. Static file accessibility via HTTP GET /uploads/mess-menu/...
 * 9. Updating/replacing menu with a newer weekly upload
 * 10. Clean database and disk artifact teardown
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const MessMenu = require('../models/MessMenu');
const connectDB = require('../config/database');
const app = require('../server');

const results = [];
function record(testNum, description, passed) {
  results.push({ testNum, description, passed });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${passed ? '✅' : '❌'} Test ${String(testNum).padStart(2, ' ')}: ${description} -> ${status}`);
}

// 1x1 transparent PNG buffer
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function sendMultipart(serverPort, pathUrl, fields, file, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
    let postData = [];

    // Add text fields
    for (const [key, value] of Object.entries(fields)) {
      postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    }

    // Add file
    if (file) {
      postData.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
        )
      );
      postData.push(file.buffer);
      postData.push(Buffer.from('\r\n'));
    }

    postData.push(Buffer.from(`--${boundary}--\r\n`));
    const fullBody = Buffer.concat(postData);

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': fullBody.length,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: serverPort,
        path: pathUrl,
        method: 'POST',
        headers,
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
    req.write(fullBody);
    req.end();
  });
}

function sendJson(serverPort, method, pathUrl, payload, token) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: serverPort,
        path: pathUrl,
        method,
        headers,
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
    if (data) req.write(data);
    req.end();
  });
}

function fetchStatic(serverPort, assetPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: serverPort,
        path: assetPath,
        method: 'GET',
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            contentType: res.headers['content-type'],
            buffer: Buffer.concat(chunks),
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runPhase4Tests() {
  console.log('\n===============================================================');
  console.log('🍽️ RUNNING PHASE 4: MESS MENU & STATIC ASSET TEST SUITE');
  console.log('===============================================================\n');

  let server;
  let serverPort;
  const unique = Date.now();
  const adminEmail = `admin.mess.${unique}@symbiosis.ac.in`;
  const studentEmail = `student.mess.${unique}@sitpune.edu.in`;
  const password = 'TestPassword@123';

  let adminToken;
  let studentToken;
  let adminId;
  let studentId;
  let createdMenuFiles = [];

  try {
    await connectDB();

    // Start local test server
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
      firstName: 'MessAdmin',
      lastName: 'P4',
      email: adminEmail,
      password: hashedPass,
      role: 'admin',
      status: 'approved',
      phone: `91${unique.toString().slice(-8)}`,
    });
    adminId = adminUser._id;

    // Setup Student
    const studentUser = await User.create({
      firstName: 'MessStudent',
      lastName: 'P4',
      email: studentEmail,
      password: hashedPass,
      role: 'student',
      status: 'approved',
      prn: `MESS${unique.toString().slice(-6)}`,
      phone: `92${unique.toString().slice(-8)}`,
    });
    studentId = studentUser._id;

    // Login Admin
    const adminLoginRes = await sendJson(serverPort, 'POST', '/api/admin/login', {
      email: adminEmail,
      password,
    });
    adminToken = adminLoginRes.body.data?.token;

    // Login Student
    const studentLoginRes = await sendJson(serverPort, 'POST', '/api/users/login', {
      email: studentEmail,
      password,
    });
    studentToken = studentLoginRes.body.data?.token;

    // Test 1: Public endpoint GET /api/mess-menu returns 200 array
    const publicMenusRes = await sendJson(serverPort, 'GET', '/api/mess-menu');
    record(1, 'Public GET /api/mess-menu returns 200 with menu array', publicMenusRes.status === 200 && Array.isArray(publicMenusRes.body.data));

    // Test 2: Public endpoint GET /api/mess-menu/latest returns 200
    const latestMenuInitRes = await sendJson(serverPort, 'GET', '/api/mess-menu/latest');
    record(2, 'GET /api/mess-menu/latest responds cleanly (200 OK)', latestMenuInitRes.status === 200 && latestMenuInitRes.body.success === true);

    // Test 3: Unauthenticated upload attempt is rejected (401 Unauthorized)
    const unauthUploadRes = await sendMultipart(serverPort, '/api/mess-menu/upload-image', {}, {
      fieldname: 'image',
      filename: 'menu.png',
      contentType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    }, null);
    record(3, 'Unauthenticated menu image upload rejected (401 Unauthorized)', unauthUploadRes.status === 401);

    // Test 4: Student role attempting upload is rejected (403 Forbidden)
    const studentUploadRes = await sendMultipart(serverPort, '/api/mess-menu/upload-image', {}, {
      fieldname: 'image',
      filename: 'menu.png',
      contentType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    }, studentToken);
    record(4, 'Student role attempting menu upload blocked (403 Forbidden)', studentUploadRes.status === 403);

    // Test 5: Admin uploads valid weekly mess menu image
    const testWeekStart = '2026-10-05';
    const adminUploadRes = await sendMultipart(
      serverPort,
      '/api/mess-menu/upload-image',
      { weekStartDate: testWeekStart },
      {
        fieldname: 'image',
        filename: `weekly-menu-${unique}.png`,
        contentType: 'image/png',
        buffer: TINY_PNG_BUFFER,
      },
      adminToken
    );
    const uploadedMenu = adminUploadRes.body.data;
    record(
      5,
      'Admin uploads weekly mess menu image successfully (200 OK with imageUrl)',
      adminUploadRes.status === 200 && adminUploadRes.body.success === true && !!uploadedMenu?.imageUrl
    );

    // Test 6: Verify uploaded image was persisted to disk in backend/uploads/mess-menu/
    let filenameOnDisk = '';
    if (uploadedMenu?.imageUrl) {
      filenameOnDisk = path.basename(uploadedMenu.imageUrl);
      const fullDiskPath = path.join(__dirname, '..', 'uploads', 'mess-menu', filenameOnDisk);
      const exists = fs.existsSync(fullDiskPath);
      if (exists) createdMenuFiles.push(fullDiskPath);
      record(6, 'Uploaded image physically saved to backend/uploads/mess-menu/', exists);
    } else {
      record(6, 'Uploaded image physically saved to backend/uploads/mess-menu/', false);
    }

    // Test 7: GET /api/mess-menu/latest returns newly uploaded weekly schedule
    const latestMenuAfterUpload = await sendJson(serverPort, 'GET', '/api/mess-menu/latest');
    const hasLatest =
      latestMenuAfterUpload.status === 200 &&
      latestMenuAfterUpload.body.data?.imageUrl?.includes(filenameOnDisk) &&
      latestMenuAfterUpload.body.data?.weekStartDate === testWeekStart;
    record(7, 'GET /api/mess-menu/latest returns active weekly menu with weekStartDate', hasLatest);

    // Test 8: Verify static asset is accessible over HTTP GET /uploads/mess-menu/...
    const staticRes = await fetchStatic(serverPort, `/uploads/mess-menu/${filenameOnDisk}`);
    record(
      8,
      'Static asset route serves uploaded image with 200 OK and valid image/png Content-Type',
      staticRes.status === 200 && staticRes.contentType?.includes('image')
    );

    // Test 9: Admin updates with new week start date and newer image
    const nextWeekStart = '2026-10-12';
    const updateUploadRes = await sendMultipart(
      serverPort,
      '/api/mess-menu/upload-image',
      { weekStartDate: nextWeekStart },
      {
        fieldname: 'image',
        filename: `weekly-menu-v2-${unique}.png`,
        contentType: 'image/png',
        buffer: TINY_PNG_BUFFER,
      },
      adminToken
    );
    const updatedMenu = updateUploadRes.body.data;
    if (updatedMenu?.imageUrl) {
      const v2DiskPath = path.join(__dirname, '..', 'uploads', 'mess-menu', path.basename(updatedMenu.imageUrl));
      if (fs.existsSync(v2DiskPath)) createdMenuFiles.push(v2DiskPath);
    }
    const latestAfterUpdate = await sendJson(serverPort, 'GET', '/api/mess-menu/latest');
    const updateSuccess =
      updateUploadRes.status === 200 &&
      latestAfterUpdate.body.data?.weekStartDate === nextWeekStart;
    record(9, 'Subsequent upload seamlessly updates latest menu and weekStartDate', updateSuccess);

    // Teardown
    await User.deleteMany({ _id: { $in: [adminId, studentId] } });
    await MessMenu.deleteMany({
      $or: [
        { lastUpdatedBy: { $in: [adminId, studentId] } },
        { day: 'weekly' }
      ]
    });

    for (const f of createdMenuFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (_) {}
    }

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    if (server) {
      await new Promise((res) => server.close(res));
    }
    await mongoose.connection.close();

    console.log('\n===============================================================');
    console.log('📊 PHASE 4 TEST SUMMARY');
    console.log('===============================================================');
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
    console.log('===============================================================\n');

    if (passed === total) {
      console.log('🎉 ALL PHASE 4 MESS MENU TESTS PASSED!\n');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runPhase4Tests();
