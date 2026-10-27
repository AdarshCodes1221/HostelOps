# Automated Testing & Verification Guide

## 1. Test Suite Summary

The Symbiosis Hostel Management System includes a comprehensive automated test harness comprising **11 dedicated test suites** totaling **178 individual test cases**.

| Suite | Target Module | Tests | Status |
| :--- | :--- | :---: | :---: |
| **Base Suite** (`verify-all.js`) | 40-Point Security, Auth, Allocation & Invariants | 40 | ✅ PASS (100%) |
| **Phase 1** (`phase1-admin-auth.test.js`) | Admin Auth, RBAC, Dashboard & Complaint Resolution | 10 | ✅ PASS (100%) |
| **Phase 2** (`phase2-dynamic-hostel-rooms.test.js`) | Dynamic Hostels, Floors, Rooms & Atomic Capacity | 14 | ✅ PASS (100%) |
| **Phase 3** (`phase3-notifications.test.js`) | Role-Aware & User-Targeted Persistent Notifications | 9 | ✅ PASS (100%) |
| **Phase 4** (`phase4-mess-menu.test.js`) | Mess Menu Uploads, Static Image Delivery & RBAC | 9 | ✅ PASS (100%) |
| **Phase 5** (`phase5-auth-security.test.js`) | HttpOnly Session Cookies & Cross-Origin Auth | 10 | ✅ PASS (100%) |
| **Phase 6** (`phase6-email-verification.test.js`) | Crypto Token Email Verification, Expiry & Resend Rate Limits | 13 | ✅ PASS (100%) |
| **Phase 7** (`phase7-password-reset-hardening.test.js`) | Password Reset Hardening, SHA-256 Hashes & Invalidation | 11 | ✅ PASS (100%) |
| **Phase 13** (`phase13-outpass.test.js`) | Digital Outpass, HMAC QR Gate Pass & Anti-Reuse | 14 | ✅ PASS (100%) |
| **Phase 16** (`api-audit-runner.js`) | Deep API Endpoint Audit, RBAC, IDOR & Zero Leak Checks | 30 | ✅ PASS (100%) |
| **Lifecycle E2E** (`full-lifecycle-e2e.js`) | Complete 18-Step Student Lifecycle End-to-End | 18 | ✅ PASS (100%) |
| **Total** | | **178** | **100% PASS** |

---

## 2. Running All Tests

To execute the entire consolidated test suite:

```bash
cd backend
npm run test
```

Or execute directly with Node:

```bash
node tests/run-all-phases.js
```

---

## 3. Running Individual Test Suites

### 1. Base Security & Allocation Invariants (40 tests):
```bash
node tests/verify-all.js
```
*Tests: Student registration, admin approval, double-booking prevention, room capacity enforcement, complaint creation, IDOR isolation.*

### 2. Phase 1: Admin Auth & Complaints (10 tests):
```bash
node tests/phase1-admin-auth.test.js
```
*Tests: Admin login, domain restrictions (`@sitpune.edu.in` rejected from admin portal), dashboard stats, department routing.*

### 3. Phase 2: Dynamic Hostels & Rooms (14 tests):
```bash
node tests/phase2-dynamic-hostel-rooms.test.js
```
*Tests: Dynamic hostel creation, floor hierarchy, compound unique index verification, room recalculation on student checkout.*

### 4. Phase 3: Persistent Notifications (9 tests):
```bash
node tests/phase3-notifications.test.js
```
*Tests: Role broadcasts (warden/admin/student), student specific alerts, unread counters, mark-as-read idempotency.*

### 5. Phase 4: Mess Menu & Static Assets (9 tests):
```bash
node tests/phase4-mess-menu.test.js
```
*Tests: Admin weekly menu upload, physical image file creation on disk, public GET latest endpoint, HTTP 200 static asset delivery.*

### 6. Phase 5: Auth Hardening & HttpOnly Cookies (10 tests):
```bash
node tests/phase5-auth-security.test.js
```
*Tests: `Set-Cookie` header inspection (`HttpOnly; SameSite=Strict`), cookie-only authentication, bearer token backward compatibility, cookie clearing on logout.*

### 7. Phase 6: Student Email Verification (13 tests):
```bash
node tests/phase6-email-verification.test.js
```
*Tests: Unverified status on register, SHA-256 token hashing, single-use invalidation, expired token rejection, 60s cooldown rate limiting on resend, generic enumeration-safe response.*

### 8. Phase 7: Password Reset Hardening (11 tests):
```bash
node tests/phase7-password-reset-hardening.test.js
```
*Tests: 15-minute token expiry, hex token validation, immediate old-password invalidation, new password validation, single-use reuse rejection.*

---

## 4. Performance & Load Benchmark (Phase 14)

### Run Autocannon Load Benchmark:
```bash
cd backend
npx autocannon -c 50 -d 10 http://localhost:5000/api/health
```

### Run k6 Script:
```bash
k6 run backend/tests/k6-performance.js
```
