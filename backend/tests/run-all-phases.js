/**
 * CONSOLIDATED TEST RUNNER: ALL PHASES
 *
 * Runs:
 * 1. Base 40-Point Security & Allocation Suite (verify-all.js)
 * 2. Phase 1: Admin Authorization & Complaint Management (phase1-admin-auth.test.js)
 * 3. Phase 2: Dynamic Hostel / Floor / Room Hierarchy (phase2-dynamic-hostel-rooms.test.js)
 * 4. Phase 3: Persistent Role-Aware Notifications (phase3-notifications.test.js)
 * 5. Phase 4: Mess Menu Publishing & Static Asset Verification (phase4-mess-menu.test.js)
 */

const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  { name: 'Base Security & Allocation (40-Point)', file: 'verify-all.js' },
  { name: 'Phase 1: Admin Auth & Complaint System', file: 'phase1-admin-auth.test.js' },
  { name: 'Phase 2: Dynamic Hostels & Rooms', file: 'phase2-dynamic-hostel-rooms.test.js' },
  { name: 'Phase 3: Persistent Notifications', file: 'phase3-notifications.test.js' },
  { name: 'Phase 4: Mess Menu & Static Assets', file: 'phase4-mess-menu.test.js' },
  { name: 'Phase 5: Auth Hardening & HttpOnly Cookies', file: 'phase5-auth-security.test.js' },
  { name: 'Phase 6: Student Email Verification', file: 'phase6-email-verification.test.js' },
  { name: 'Phase 7: Password Reset Hardening', file: 'phase7-password-reset-hardening.test.js' },
  { name: 'Phase 13: Outpass & Digital Gate Pass', file: 'phase13-outpass.test.js' },
  { name: 'Phase 16: Deep API Endpoint & Leak Audit', file: 'api-audit-runner.js' },
  { name: 'Phase 4: Full Student Lifecycle E2E', file: 'full-lifecycle-e2e.js' },
];

console.log('\n===============================================================');
console.log('🧪 RUNNING ALL PRODUCTION TEST SUITES');
console.log('===============================================================\n');

let allPassed = true;
const summary = [];

for (const suite of suites) {
  console.log(`▶ Running: ${suite.name} (${suite.file})...`);
  const startTime = Date.now();
  const result = spawnSync(process.execPath, [path.join(__dirname, suite.file)], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = result.status === 0;
  if (!passed) allPassed = false;

  summary.push({
    name: suite.name,
    file: suite.file,
    passed,
    durationSec,
  });
  console.log(`---------------------------------------------------------------\n`);
}

console.log('\n===============================================================');
console.log('🏆 CONSOLIDATED TEST RESULTS');
console.log('===============================================================');
for (const s of summary) {
  const badge = s.passed ? '✅ PASSED' : '❌ FAILED';
  console.log(` ${badge.padEnd(10)} | ${s.name.padEnd(42)} | (${s.durationSec}s)`);
}
console.log('===============================================================');

if (allPassed) {
  console.log('\n🎉 ALL PRODUCTION TEST SUITES PASSED! 100% SUCCESS RATE.\n');
  process.exit(0);
} else {
  console.error('\n❌ ONE OR MORE TEST SUITES FAILED. SEE DETAILS ABOVE.\n');
  process.exit(1);
}
