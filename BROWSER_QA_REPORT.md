# Symbiosis Hostel Management System — Final Real-Browser QA Report

**Date of Execution:** October 4, 2026  
**Target Environment:** Containerized Production Multi-Container Docker Stack  
**Frontend URL:** `http://localhost:8080` (NGINX Alpine SPA + Reverse Proxy)  
**Backend API URL:** `http://localhost:5000/api` & `http://localhost:8080/api` (Node 20 Alpine)  
**Database:** MongoDB Atlas Cluster (`test` database)  
**Browser Engine:** Microsoft Edge / Google Chrome (Chromium Engine v128+ via CDP)  
**Test Automation Runner:** `backend/qa-browser-runner.js`  
**Overall Status:** ✅ **100% PASS (ALL 20 CATEGORIES VERIFIED)**

---

## 📸 Real Browser Screenshot Index & Workflow Audit

| Category | Screenshot File | Workflow / Step Tested | Expected Result | Actual Observed UI Result | Status |
|---|---|---|---|---|---|
| **01-registration** | `01-registration/01-registration-blank-form.png` | Registration Form Initial State | Form renders with all required academic & personal fields | Clean Shadcn UI form with labels, placeholders, and university domain hints | ✅ PASS |
| **01-registration** | `01-registration/02-registration-invalid-domain-error.png` | Non-University Email Domain Rejection | Students attempting non-`@sitpune.edu.in` emails get rejected | Instant validation error: `"Students must register with an official university email (@sitpune.edu.in)"` | ✅ PASS |
| **01-registration** | `01-registration/03-registration-valid-form-filled.png` | Valid Student Form Completion | All fields populated (PRN, Phone, Emergency, Password) | Clean validation state, submit button active | ✅ PASS |
| **01-registration** | `01-registration/04-registration-success-submitted.png` | Successful Student Registration Submission | Account created with `status: pending`, no room auto-assigned | Success toast / redirect to verification instructions | ✅ PASS |
| **02-email-verification** | `02-email-verification/01-email-verification-screen.png` | Student Email Verification Screen | Form accepts 64-character SHA-256 token or link | Clean UI with token input and verification feedback banner | ✅ PASS |
| **03-student-login** | `03-student-login/01-student-login-page.png` | Student Portal Login Initial State | Clean portal with email & password fields | Rendered correctly with link to registration and forgot password | ✅ PASS |
| **03-student-login** | `03-student-login/02-student-bad-password-error.png` | Bad Credentials Negative Test | Rejection with generic error, no credential leakage | UI error alert: `"Invalid email or password"` without exposing user existence | ✅ PASS |
| **03-student-login** | `03-student-login/03-student-login-success.png` | Student A Authentication | Successful authentication, JWT stored in HttpOnly cookie | Smooth redirect to student dashboard | ✅ PASS |
| **04-admin-login** | `04-admin-login/01-admin-login-screen.png` | Dedicated Admin & Staff Login Portal | High-security login screen for Admin, Warden, and Security | Dedicated staff authentication card rendered | ✅ PASS |
| **04-admin-login** | `04-admin-login/02-admin-login-success.png` | Staff Authentication | Admin/Warden credentials verified server-side | Immediate redirect to staff control panel | ✅ PASS |
| **05-dashboard** | `05-dashboard/01-student-dashboard.png` | Student A Dashboard | Personalized stats, room information, quick service cards | Displays Student A name, room 101, quick complaint and outpass links | ✅ PASS |
| **05-dashboard** | `05-dashboard/02-admin-dashboard.png` | Master Admin Dashboard | Campus statistics, room occupancy, pending student queues | KPI cards (total students, pending approvals, active complaints, occupancy) | ✅ PASS |
| **05-dashboard** | `05-dashboard/03-warden-dashboard.png` | Warden Operational Dashboard | Operational metrics focused on grievances and outpasses | Streamlined operational dashboard for hostel oversight | ✅ PASS |
| **06-room-allocation** | `06-room-allocation/01-student-room-allocated-view.png` | Student View of Allocated Room | Displays hostel, floor, room number (locked/read-only) | Student A sees "Symbiosis Royal Hostel, Floor 1, Room 101" with zero edit inputs | ✅ PASS |
| **06-room-allocation** | `06-room-allocation/02-admin-room-management.png` | Admin Room Management & Capacity Control | Grid of hostels, floors, room capacities and current occupants | Visual cards for Room 101 (3 capacity) and Room 102 (2 capacity) with assignment controls | ✅ PASS |
| **07-complaints** | `07-complaints/01-complaint-submission-page.png` | Grievance Redressal Form | Auto-bound room details, title, category, description | Room 101 is immutable and auto-filled from session | ✅ PASS |
| **07-complaints** | `07-complaints/02-complaint-form-filled-locked-room.png` | Complaint Form Filled (Room Spoofing Defense) | Location strictly matches authenticated student's room | Request payload automatically bound by backend to student's room | ✅ PASS |
| **07-complaints** | `07-complaints/03-complaint-submitted-successfully.png` | Complaint Creation Success | New complaint added to student's list with status `pending` | Complaint appears in active table with timestamp and category badge | ✅ PASS |
| **07-complaints** | `07-complaints/04-admin-complaints-management.png` | Admin/Warden Complaint Management | Staff can view all complaints, filter, and update status | Action dropdowns for "In Progress" / "Resolved" and staff remarks | ✅ PASS |
| **08-notifications** | `08-notifications/01-notification-badge-visible.png` | Real-time Notification Bell & Badge | Unread counter displays unread event count | Unread indicator badge visible on header bell icon | ✅ PASS |
| **09-mess-menu** | `09-mess-menu/01-student-mess-menu-view.png` | Student Weekly Mess Menu View | Day-wise meal breakdown (Breakfast, Lunch, Snacks, Dinner) | Tabbed interface showing meals for all 7 days with nutritional options | ✅ PASS |
| **09-mess-menu** | `09-mess-menu/02-admin-mess-menu-management.png` | Admin Mess Menu Control | Upload weekly menu, set start date, update meal items | Admin meal editor interface with live preview | ✅ PASS |
| **10-notices** | `10-notices/01-student-notices-board.png` | Official Campus Notice Board | Chronological listing of official hostel circulars | Verified notices with dates, priorities, and author titles | ✅ PASS |
| **10-notices** | `10-notices/02-admin-notices-management.png` | Admin Notice Publisher | Create notices with title, category, priority, and expiry | Multi-field notice creation modal with immediate broadcast | ✅ PASS |
| **11-bus** | `11-bus/01-bus-routes-schedule.png` | Campus Shuttle Routes & Timings | Route numbers, departure times, stops, and bus numbers | Route 1 (Main Gate to SIT Academic Block A) with stop chips and timings | ✅ PASS |
| **12-booking** | `12-booking/01-facility-booking-page.png` | Hostel Common Amenities Booking | Common room, study hall, gym slot reservations | Calendar/slot booking interface with date & time selection | ✅ PASS |
| **13-outpass** | `13-outpass/01-outpass-history-and-request-form.png` | Student Digital Outpass Portal | Request form with departure time, return time, reason, destination | History list of previous passes with status chips | ✅ PASS |
| **13-outpass** | `13-outpass/02-outpass-request-filled.png` | Outpass Request Population | Form filled with emergency details and purpose | All fields validated before submission | ✅ PASS |
| **13-outpass** | `13-outpass/03-outpass-requested-success.png` | Outpass Submitted to Warden | Request queued with `status: pending` | Table updates with new request awaiting warden review | ✅ PASS |
| **13-outpass** | `13-outpass/04-warden-outpass-review-table.png` | Warden Outpass Review Queue | List of pending requests with Approve / Reject buttons | Warden table displaying Student A request with 1-click approval modal | ✅ PASS |
| **14-qr-generation** | `14-qr-generation/01-student-outpass-qr-code-modal.png` | Cryptographically Signed QR Pass Modal | High-resolution 2D QR code rendered client-side | QR contains opaque passCode (`OP-QA998877665544`) + server HMAC signature; zero secrets exposed | ✅ PASS |
| **15-qr-verification** | `15-qr-verification/01-security-verification-screen.png` | Campus Security / Gate Guard Verification Portal | Scanner camera viewport + manual Pass Code input field | Dedicated staff interface at `/security/verify` restricted to security role | ✅ PASS |
| **15-qr-verification** | `15-qr-verification/02-valid-outpass-verified-student-details.png` | Valid Gate Pass Signature Verification | Server validates HMAC-SHA256 signature and returns minimal student details | Displays "VALID OUTPASS", Student Name: Aarav Sharma, Hostel: Symbiosis Royal Hostel, Room: 101, Destination: SCHC | ✅ PASS |
| **16-gate-checkout** | `16-gate-checkout/01-checkout-successful-pass-closed.png` | Gate Checkout Atomic Execution | Guard clicks "VERIFY & CHECK OUT", status changes to `used` | Banner displays "CHECK-OUT SUCCESSFUL - Record Closed", timestamp recorded, pass closed | ✅ PASS |
| **17-security** | `17-security/01-pass-already-used-rejection.png` | QR Pass Reuse Rejection Test | Re-scanning exact same pass code fails immediately | UI displays red error alert: `"Gate Pass ALREADY USED. Exit Denied."`; checkout button disabled | ✅ PASS |
| **17-security** | `17-security/02-forged-qr-rejection.png` | Forged / Tampered Pass Code Rejection | Altered or client-fabricated pass codes rejected (404/400) | UI displays `"Invalid or unapproved outpass"`; audit log captures attempt | ✅ PASS |
| **17-security** | `17-security/03-security-least-privilege-blocked.png` | Security Role Least-Privilege Enforcement | Guard attempting `/admin/complaints` or `/admin/rooms` is blocked | 403 Forbidden redirect; guard restricted strictly to gate verification | ✅ PASS |
| **18-logout** | `18-logout/01-logged-out-to-login.png` | Clean Logout Action | Clearing HttpOnly cookie and client state | Redirect to `/login` with clean storage | ✅ PASS |
| **18-logout** | `18-logout/02-unauthorized-redirect-to-login.png` | Back-Button & Direct URL Protection | Attempting `/dashboard` after logout redirects immediately | Guarded route redirects unauthenticated user back to `/login` | ✅ PASS |
| **19-mobile** | `19-mobile/01-mobile-login-view-375px.png` | Mobile Viewport (375x812 iPhone) | Full-width inputs, no horizontal overflow, touch-friendly buttons | Zero horizontal scrolling; responsive layout verified | ✅ PASS |
| **19-mobile** | `19-mobile/02-mobile-security-scanner-375px.png` | Mobile Security Gate Scanner (375x812) | Handheld security guard scanner interface | Touch-friendly camera scan button and pass code input | ✅ PASS |
| **19-mobile** | `19-mobile/03-tablet-mess-menu-768px.png` | Tablet Viewport (768x1024 iPad) | Grid layout adapts smoothly to 2-column format | Mess menu day cards render cleanly with responsive typography | ✅ PASS |
| **20-errors** | `20-errors/01-registration-validation-errors.png` | Client Validation on Incomplete Registration | Required field warnings displayed below invalid inputs | Inline red validation helpers under required fields | ✅ PASS |
| **20-errors** | `20-errors/02-student-invalid-credentials.png` | Authentication Error Feedback | Safe user-facing feedback on invalid credentials | Clean alert component with zero internal stack trace exposure | ✅ PASS |
| **20-errors** | `20-errors/03-invalid-outpass-error.png` | Gate Pass Rejection Error Display | Clear message informing guard of unapproved/forged pass | Prominent red denial badge preventing gate exit | ✅ PASS |
| **20-errors** | `20-errors/04-404-not-found-page.png` | 404 Route Catch-All | Graceful fallback page for non-existent paths | "Page Not Found" screen with button returning to dashboard | ✅ PASS |

---

## 🔒 Security Model & Least-Privilege Role Matrix

| Capability | Student | Campus Security / Guard | Warden | Master Admin |
|---|---|---|---|---|
| Register / Verify Email | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Login to Student Portal | ✅ Yes | ❌ No (403) | ❌ No (403) | ❌ No (403) |
| Login to Staff Portal | ❌ No (403) | ✅ Yes | ✅ Yes | ✅ Yes |
| View Personal Room | ✅ Read-only | ❌ No | ✅ View all | ✅ View all |
| Modify / Allocate Rooms | ❌ Forbidden | ❌ Forbidden (403) | ❌ Forbidden (403) | ✅ Authorized |
| Submit Complaints | ✅ Auto-bound | ❌ Forbidden | ❌ No | ❌ No |
| Resolve Complaints | ❌ Forbidden | ❌ Forbidden (403) | ✅ Authorized | ✅ Authorized |
| Request Outpass | ✅ Authorized | ❌ Forbidden | ❌ No | ❌ No |
| Approve / Reject Outpass | ❌ Forbidden | ❌ Forbidden (403) | ✅ Authorized | ✅ Authorized |
| View Personal Pass & QR | ✅ Authorized | ❌ No | ✅ View all | ✅ View all |
| Scan & Verify QR Gate Pass | ❌ Forbidden | ✅ Dedicated Portal | ✅ Authorized | ✅ Authorized |
| Perform Gate Check-Out | ❌ Forbidden | ✅ Single-use atomic | ✅ Authorized | ✅ Authorized |
| Modify Mess Menu / Notices | ❌ Forbidden | ❌ Forbidden (403) | ❌ Forbidden (403) | ✅ Authorized |
| View Private Student Records | ❌ Forbidden | ❌ Forbidden (403) | ❌ Filtered | ✅ Authorized |

---

## 🧪 Outpass Cryptographic HMAC Verification & Anti-Reuse Audit

1. **Server-Side Signature Generation:**
   - Every approved outpass is cryptographically signed using `crypto.createHmac('sha256', process.env.JWT_SECRET)` hashing `passCode + studentId + departureDate`.
   - The signing secret is NEVER serialized to the client, never included in the QR image, and never transmitted in any API response.
2. **Single-Use Gate Checkout:**
   - When campus security clicks "VERIFY & CHECK OUT", `POST /api/outpass/checkout` atomically transitions status from `'approved'` to `'used'`.
   - `usedAt` server timestamp and `verifiedBy` security staff ID are committed to MongoDB.
   - An audit trail entry (`CHECKED_OUT`) is logged into the outpass document.
3. **Replay & Anti-Reuse Enforcement:**
   - When the exact same QR code or passCode is re-scanned, the backend returns HTTP 400 with `"Gate Pass ALREADY USED. Exit Denied."`.
   - Re-scan attempt is logged as `REUSE_ATTEMPTED` in the audit history.
4. **Forged / Tampered QR Defense:**
   - Forged pass codes (e.g. `OP-FORGED-TAMPERED-999`) or modified QR payloads return HTTP 404/400.
   - Client-provided student data in request bodies is discarded; verified student metadata is loaded solely from the authenticated database record.
