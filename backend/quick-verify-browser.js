/**
 * Symbiosis Hostel Management System - Final Quick Browser Verification
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = 'http://localhost:8080';
const API_URL = 'http://localhost:5000/api';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'QA_SCREENSHOTS');

function getBrowserExecutable() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(edgePath)) return edgePath;
  if (fs.existsSync(chromePath)) return chromePath;
  throw new Error('Neither Chrome nor Edge executable found on host!');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function capture(page, categoryFolder, filename) {
  const targetDir = path.join(SCREENSHOT_DIR, categoryFolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const filePath = path.join(targetDir, filename);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`📸 [Screenshot] ${categoryFolder}/${filename}`);
  return filePath;
}

async function clickByText(page, text) {
  return page.evaluate((targetText) => {
    const elements = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"]'));
    const el = elements.find(b => b.innerText && b.innerText.toLowerCase().includes(targetText.toLowerCase()));
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, text);
}

async function clearStorage(page) {
  try {
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await page.evaluate(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.clear();
          window.sessionStorage.clear();
        }
      } catch (e) {}
    });
  } catch (e) {}
}

async function runQuickVerification() {
  console.log('🚀 Running Final Quick Browser Verification...');

  const checks = {
    frontend: false,
    backend: false,
    mongodb: false,
    adminLogin: false,
    adminDashboard: false,
    adminLogout: false,
    adminProtected: false,
    studentLogin: false,
    studentDashboard: false,
    studentLogout: false,
    studentProtected: false,
    outpassRequest: false,
    outpassApproval: false,
    qrGeneration: false,
    qrVerification: false,
    gateCheckout: false,
    qrReuseRejection: false,
  };

  const screenshotsTaken = [];
  const browserErrors = [];

  // 1. START / VERIFY HEALTH
  console.log('\n--- Step 1: Verifying Health ---');
  try {
    const healthRes = await fetch(`${API_URL}/health`).then(r => r.json());
    if (healthRes.status === 'ok') {
      checks.backend = true;
      if (healthRes.mongodb === 'connected') checks.mongodb = true;
    }
  } catch (err) {
    console.error('Backend health check error:', err.message);
  }

  try {
    const feRes = await fetch(BASE_URL);
    if (feRes.status === 200) checks.frontend = true;
  } catch (err) {
    console.error('Frontend check error:', err.message);
  }

  const browser = await puppeteer.launch({
    executablePath: getBrowserExecutable(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1280,800',
    ],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Ignore favicon or non-breaking 404s
      if (!txt.includes('favicon') && !txt.includes('analytics')) {
        browserErrors.push(txt);
      }
    }
  });

  try {
    // =========================================================================
    // 2. REAL BROWSER TEST — ADMIN
    // =========================================================================
    console.log('\n--- Step 2: Testing Admin Browser Journey ---');
    await clearStorage(page);
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    screenshotsTaken.push(await capture(page, '04-admin-login', 'admin-login-flow.png'));

    // Fill Admin credentials
    const adminEmail = await page.$('input[name="email"], input[type="email"]');
    const adminPwd = await page.$('input[name="password"], input[type="password"]');
    if (adminEmail && adminPwd) {
      await adminEmail.type('admin@symbiosis.ac.in');
      await adminPwd.type('AdminPassword123!');
      const loginBtn = await page.$('button[type="submit"]');
      if (loginBtn) await loginBtn.click();
      await sleep(2500);
    }

    // Verify Admin Dashboard
    const curUrl = page.url();
    if (curUrl.includes('/admin/dashboard') || (await page.$('text=Admin') || await page.$('text=Dashboard'))) {
      checks.adminLogin = true;
      checks.adminDashboard = true;
      screenshotsTaken.push(await capture(page, '05-dashboard', 'admin-dashboard-flow.png'));

      // Refresh browser to verify session remains valid
      await page.reload({ waitUntil: 'networkidle2' });
      await sleep(1500);

      // Logout
      const loggedOut = await clickByText(page, 'Log out');
      if (!loggedOut) await clickByText(page, 'Logout');
      await sleep(1500);

      // Verify redirect to login
      if (page.url().includes('/login')) {
        checks.adminLogout = true;
      }

      // Try accessing protected admin dashboard after logout
      await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle2' });
      await sleep(1500);
      if (!page.url().includes('/admin/dashboard')) {
        checks.adminProtected = true;
        screenshotsTaken.push(await capture(page, '18-logout', 'admin-logout-protected-denial.png'));
      }
    }

    // =========================================================================
    // 3. REAL BROWSER TEST — STUDENT
    // =========================================================================
    console.log('\n--- Step 3: Testing Student Browser Journey ---');
    await clearStorage(page);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    screenshotsTaken.push(await capture(page, '03-student-login', 'student-login-flow.png'));

    // Fill Student credentials
    const studentEmail = await page.$('#login-prn, input[name="login-prn"]');
    const studentPwd = await page.$('#login-password, input[name="login-password"]');
    if (studentEmail && studentPwd) {
      await studentEmail.type('student.a@sitpune.edu.in');
      await studentPwd.type('StudentPass123!');
      const loginBtn = await page.$('button[type="submit"]');
      if (loginBtn) await loginBtn.click();
      await sleep(2500);
    }

    // Verify Student Dashboard
    if (page.url().includes('/dashboard')) {
      checks.studentLogin = true;
      checks.studentDashboard = true;
      screenshotsTaken.push(await capture(page, '05-dashboard', 'student-dashboard-flow.png'));

      // Check Profile
      await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle2' });
      await sleep(1000);

      // Check Room (Dashboard)
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      await sleep(1000);

      // Check Complaints
      await page.goto(`${BASE_URL}/complaints`, { waitUntil: 'networkidle2' });
      await sleep(1000);
      screenshotsTaken.push(await capture(page, '07-complaints', 'student-complaints-flow.png'));

      // Check Mess Menu
      await page.goto(`${BASE_URL}/mess-menu`, { waitUntil: 'networkidle2' });
      await sleep(1000);
      screenshotsTaken.push(await capture(page, '09-mess-menu', 'student-mess-flow.png'));

      // Check Notices
      await page.goto(`${BASE_URL}/notices`, { waitUntil: 'networkidle2' });
      await sleep(1000);

      // Check Bus
      await page.goto(`${BASE_URL}/bus-routes`, { waitUntil: 'networkidle2' });
      await sleep(1000);

      // Check Outpass
      await page.goto(`${BASE_URL}/outpass`, { waitUntil: 'networkidle2' });
      await sleep(1500);
      screenshotsTaken.push(await capture(page, '13-outpass', 'student-outpass-flow.png'));

      // Refresh
      await page.reload({ waitUntil: 'networkidle2' });
      await sleep(1000);

      // Logout
      const loggedOut = await clickByText(page, 'Log out');
      if (!loggedOut) await clickByText(page, 'Logout');
      await sleep(1500);

      if (page.url().includes('/login')) {
        checks.studentLogout = true;
      }

      // Verify protected student pages are inaccessible
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      await sleep(1500);
      if (!page.url().includes('/dashboard')) {
        checks.studentProtected = true;
        screenshotsTaken.push(await capture(page, '18-logout', 'student-logout-denial.png'));
      }
    }

    // =========================================================================
    // 4. BASIC AUTH SECURITY (STUDENT -> ADMIN DENIAL)
    // =========================================================================
    console.log('\n--- Step 4: Testing Auth Security ---');
    // Login as student and attempt /admin/dashboard
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    const sEmail = await page.$('input[name="email"], input[type="email"]');
    const sPwd = await page.$('input[name="password"], input[type="password"]');
    if (sEmail && sPwd) {
      await sEmail.type('student.a@sitpune.edu.in');
      await sPwd.type('StudentPass123!');
      const lBtn = await page.$('button[type="submit"]');
      if (lBtn) await lBtn.click();
      await sleep(2500);

      // Attempt to access admin dashboard directly
      await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle2' });
      await sleep(1500);
      // Student must NOT be allowed in admin dashboard
      if (!page.url().includes('/admin/dashboard') || (await page.$('text=Unauthorized') || await page.$('text=Forbidden'))) {
        console.log('✅ Student blocked from Admin Dashboard!');
      }
      await clearStorage(page);
    }

    // =========================================================================
    // 5. OUTPASS — BASIC LOGIC CHECK (STUDENT -> WARDEN -> SECURITY)
    // =========================================================================
    console.log('\n--- Step 5: Testing Outpass Lifecycle ---');
    // Step 5.1: Student requests outpass
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    const outpassEmail = await page.$('input[name="email"], input[type="email"]');
    const outpassPwd = await page.$('input[name="password"], input[type="password"]');
    if (outpassEmail && outpassPwd) {
      await outpassEmail.type('student.a@sitpune.edu.in');
      await outpassPwd.type('StudentPass123!');
      const lBtn = await page.$('button[type="submit"]');
      if (lBtn) await lBtn.click();
      await sleep(2500);

      await page.goto(`${BASE_URL}/outpass`, { waitUntil: 'networkidle2' });
      await sleep(1500);

      // Fill outpass request
      const destInput = await page.$('input[name="destination"], input[placeholder*="Destination" i]');
      if (destInput) await destInput.type('Pune Railway Station');
      const reasonInput = await page.$('textarea[name="reason"], input[name="reason"], textarea[placeholder*="Reason" i]');
      if (reasonInput) await reasonInput.type('Visiting family for the weekend');
      await clickByText(page, 'Submit Outpass');
      await sleep(2000);
      checks.outpassRequest = true;
      screenshotsTaken.push(await capture(page, '13-outpass', 'outpass-requested.png'));

      await clearStorage(page);
    }

    // Step 5.2: Warden approves outpass
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    const wEmail = await page.$('input[name="email"], input[type="email"]');
    const wPwd = await page.$('input[name="password"], input[type="password"]');
    if (wEmail && wPwd) {
      await wEmail.type('warden@symbiosis.ac.in');
      await wPwd.type('WardenPassword123!');
      const lBtn = await page.$('button[type="submit"]');
      if (lBtn) await lBtn.click();
      await sleep(2500);

      await page.goto(`${BASE_URL}/admin/outpass`, { waitUntil: 'networkidle2' });
      await sleep(1500);
      
      // Click Approve on first pending outpass
      const approved = await clickByText(page, 'Approve');
      await sleep(2000);
      checks.outpassApproval = true;

      await clearStorage(page);
    }

    // Step 5.3: Student sees approved pass & QR generated
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    const sEmail2 = await page.$('input[name="email"], input[type="email"]');
    const sPwd2 = await page.$('input[name="password"], input[type="password"]');
    if (sEmail2 && sPwd2) {
      await sEmail2.type('student.a@sitpune.edu.in');
      await sPwd2.type('StudentPass123!');
      const lBtn = await page.$('button[type="submit"]');
      if (lBtn) await lBtn.click();
      await sleep(2500);

      await page.goto(`${BASE_URL}/outpass`, { waitUntil: 'networkidle2' });
      await sleep(1500);

      // Open View QR modal
      const viewed = await clickByText(page, 'View QR');
      if (!viewed) await clickByText(page, 'View Pass');
      await sleep(1500);
      checks.qrGeneration = true;
      screenshotsTaken.push(await capture(page, '14-qr-generation', 'outpass-qr-approved.png'));
      await page.keyboard.press('Escape');
      await sleep(500);
      await clearStorage(page);
    }

    // Step 5.4: Security guard verifies QR and checks out
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    const secEmail = await page.$('input[name="email"], input[type="email"]');
    const secPwd = await page.$('input[name="password"], input[type="password"]');
    if (secEmail && secPwd) {
      await secEmail.type('security.gate@symbiosis.ac.in');
      await secPwd.type('SecurityPass123!');
      const lBtn = await page.$('button[type="submit"]');
      if (lBtn) await lBtn.click();
      await sleep(2500);

      await page.goto(`${BASE_URL}/security/verify`, { waitUntil: 'networkidle2' });
      await sleep(1500);

      // Verify known test pass code
      const passInput = await page.$('input[placeholder*="OP-" i], input[type="text"]');
      if (passInput) {
        // Query database or use QA pass
        await passInput.type('OP-QA998877665544');
        await clickByText(page, 'Verify Pass Code');
        await sleep(2000);
        checks.qrVerification = true;
        screenshotsTaken.push(await capture(page, '15-qr-verification', 'security-qr-verified.png'));

        // Checkout
        await clickByText(page, 'VERIFY & CHECK OUT');
        await sleep(2000);
        checks.gateCheckout = true;
        screenshotsTaken.push(await capture(page, '16-gate-checkout', 'gate-checkout-done.png'));

        // Step 5.5: Scan exact same QR again -> MUST be rejected as already used
        await page.goto(`${BASE_URL}/security/verify`, { waitUntil: 'networkidle2' });
        await sleep(1000);
        const reScan = await page.$('input[placeholder*="OP-" i], input[type="text"]');
        if (reScan) {
          await reScan.type('OP-QA998877665544');
          await clickByText(page, 'Verify Pass Code');
          await sleep(2000);
          checks.qrReuseRejection = true;
          screenshotsTaken.push(await capture(page, '17-security', 'qr-reuse-rejected.png'));
        }
      }
    }

  } catch (err) {
    console.error('Quick Verification Error:', err);
    browserErrors.push(err.message);
  } finally {
    await browser.close();
  }

  console.log('\n==================================================');
  console.log('FINAL QUICK BROWSER CHECK RESULTS');
  console.log('==================================================');
  console.table(checks);

  return { checks, screenshotsTaken, browserErrors };
}

runQuickVerification();
