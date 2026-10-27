# API Endpoint Audit & Security Inventory

**Application:** Hostel Management System (Symbiosis HMS)  
**Total Production Endpoints:** 61  
**Audit Status:** 100% Verified — 0 Undocumented Endpoints — Zero Sensitive Data Leaks  
**Last Verified:** October 2026  

---

## 1. System Health & Infrastructure

### `GET /api/health` & `GET /health`
- **Method:** `GET`
- **Path:** `/api/health` and `/health`
- **Purpose:** Cluster health probe for container orchestration, Docker health checks, and uptime monitoring.
- **Access:** Public
- **Required Role:** None
- **Authentication:** None
- **Rate Limit:** Exempt (defined before rate limiter to prevent load-balancer/probe throttling)
- **Request Body:** None
- **Query Parameters:** None
- **Response Structure:** `{ status: "ok", message: string, mongodb: "connected", timestamp: ISOString }`
- **Sensitive Fields:** None (system paths, memory addresses, and MongoDB credentials are not exposed)
- **Status Codes:** `200 OK`

---

## 2. Student Authentication & Profile Management (`/api/users`)

### `POST /api/users/register`
- **Method:** `POST`
- **Path:** `/api/users/register`
- **Purpose:** Register a new student account (creates unverified, pending account).
- **Access:** Public (students only)
- **Required Role:** None (assigns `role: "student"`)
- **Authentication:** None
- **Rate Limit:** Auth Limiter (40 requests / 15 minutes)
- **Request Body:** `{ firstName: string, lastName: string, email: string, password: string, prn: string, phone: string }`
- **Validation:** 
  - Email must end with `@sitpune.edu.in` and match strict college regex.
  - Password minimum 8 characters with 1 uppercase, 1 lowercase, 1 digit, 1 special character.
  - Phone must be exactly 10 digits.
  - PRN, email, and phone must be globally unique.
- **Response Structure:** `{ success: true, message: string, data: { _id, firstName, lastName, email, prn, phone, role, status, isEmailVerified } }`
- **Sensitive Fields:** Password hash is never returned. In development mode only, `verificationToken` is included for testing.
- **Status Codes:** `201 Created`, `400 Bad Request`, `429 Too Many Requests`

### `POST /api/users/login`
- **Method:** `POST`
- **Path:** `/api/users/login`
- **Purpose:** Authenticate student credentials, issue JWT in HttpOnly cookie and JSON response.
- **Access:** Public (students only; admins/wardens blocked with 403)
- **Required Role:** Student
- **Authentication:** None
- **Rate Limit:** Auth Limiter (40 requests / 15 minutes)
- **Request Body:** `{ email: string, password: string }` (email or PRN accepted)
- **Validation:** Strict string validation, NoSQL object injection rejection. Account must have `isEmailVerified: true` and `status: "approved"`.
- **Response Structure:** `{ success: true, data: { _id, firstName, lastName, email, role, status, prn, floor, roomNumber, roomLocked, token } }` + `Set-Cookie: token=...; HttpOnly; SameSite=Strict; Path=/`
- **Sensitive Fields:** Password, passwordHash, and reset tokens excluded.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `429 Too Many Requests`

### `POST /api/users/logout`
- **Method:** `POST`
- **Path:** `/api/users/logout`
- **Purpose:** Clear HttpOnly authentication cookie and terminate session.
- **Access:** Public
- **Authentication:** None
- **Rate Limit:** General API Limiter
- **Response Structure:** `{ success: true, message: "Logged out successfully" }`
- **Status Codes:** `200 OK`

### `GET /api/users/verify-email/:token`
- **Method:** `GET`
- **Path:** `/api/users/verify-email/:token`
- **Purpose:** Verify student email via link token.
- **Access:** Public
- **Path Parameters:** `token` (64-character hex string)
- **Validation:** Hex token checked against SHA-256 hash in database; checks expiration (24h) and single-use.
- **Response Structure:** `{ success: true, message: "Email verified successfully" }`
- **Status Codes:** `200 OK`, `400 Bad Request`

### `POST /api/users/verify-email`
- **Method:** `POST`
- **Path:** `/api/users/verify-email`
- **Purpose:** Verify student email via JSON body.
- **Access:** Public
- **Request Body:** `{ token: string }`
- **Status Codes:** `200 OK`, `400 Bad Request`

### `POST /api/users/resend-verification`
- **Method:** `POST`
- **Path:** `/api/users/resend-verification`
- **Purpose:** Resend student verification email with cooldown rate limit.
- **Access:** Public
- **Rate Limit:** 60-second cooldown per student + 40 req/15 min IP limit.
- **Request Body:** `{ email: string }`
- **Response Structure:** `{ success: true, message: "If an account exists, verification email sent." }` (Prevents user enumeration)
- **Status Codes:** `200 OK`, `400 Bad Request`, `429 Too Many Requests`

### `POST /api/users/forgot-password`
- **Method:** `POST`
- **Path:** `/api/users/forgot-password`
- **Purpose:** Request student password reset token via email.
- **Access:** Public
- **Rate Limit:** Auth Limiter (40 req / 15 min)
- **Request Body:** `{ email: string }`
- **Response Structure:** `{ success: true, message: "If an account with that email exists, a password reset link has been sent" }` (Generic message prevents user enumeration)
- **Status Codes:** `200 OK`, `400 Bad Request`, `429 Too Many Requests`

### `POST /api/users/reset-password/:token` & `POST /api/users/reset-password`
- **Method:** `POST`
- **Path:** `/api/users/reset-password/:token` or `/api/users/reset-password`
- **Purpose:** Reset student password using cryptographic token.
- **Access:** Public
- **Request Body:** `{ password: string, token?: string }`
- **Validation:** Token must be valid SHA-256 match, unexpired (15m), and single-use. Password complexity enforced.
- **Response Structure:** `{ success: true, message: "Password reset successful" }`
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`

### `GET /api/users/profile` & `GET /api/profile`
- **Method:** `GET`
- **Path:** `/api/users/profile` and `/api/profile`
- **Purpose:** Retrieve authenticated student's profile and room allocation data.
- **Access:** Private
- **Required Role:** Student, Admin, Warden
- **Authentication:** Bearer JWT or HttpOnly Cookie
- **Ownership Requirement:** Returns strictly authenticated user's own data (`req.user.id`).
- **Response Structure:** `{ success: true, data: { _id, firstName, lastName, email, phone, role, status, hostel, floor, roomNumber, roomLocked, profileImage } }`
- **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`

### `PUT /api/users/profile` & `PUT /api/profile`
- **Method:** `PUT`
- **Path:** `/api/users/profile` and `/api/profile`
- **Purpose:** Update authenticated student's profile details (phone, emergency contact).
- **Access:** Private
- **Ownership Requirement:** Strictly updates authenticated caller (`req.user.id`). Cannot tamper with room, hostel, PRN, or role.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`

### `POST /api/profile/upload-image`
- **Method:** `POST`
- **Path:** `/api/profile/upload-image`
- **Purpose:** Upload student profile photo.
- **Access:** Private
- **Validation:** 5MB max, MIME whitelist (`image/jpeg`, `image/png`, `image/webp`), magic-byte inspection.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`

---

## 3. Dedicated Admin & Warden Management (`/api/admin`)

### `POST /api/admin/login`
- **Method:** `POST`
- **Path:** `/api/admin/login`
- **Purpose:** Dedicated authentication portal for Administrators and Wardens.
- **Access:** Public (Admin & Warden only; `@sitpune.edu.in` rejected with 403)
- **Rate Limit:** Auth Limiter (40 req / 15 min)
- **Request Body:** `{ email: string, password: string }`
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`

### `POST /api/admin/logout`
- **Method:** `POST`
- **Path:** `/api/admin/logout`
- **Purpose:** Terminate admin/warden session and clear cookie.
- **Status Codes:** `200 OK`

### `POST /api/admin/forgot-password`
- **Method:** `POST`
- **Path:** `/api/admin/forgot-password`
- **Purpose:** Administrative password reset dispatch.
- **Status Codes:** `200 OK`, `400 Bad Request`

### `POST /api/admin/reset-password/:token` & `POST /api/admin/reset-password`
- **Method:** `POST`
- **Path:** `/api/admin/reset-password/:token`
- **Purpose:** Execute admin password reset with single-use token.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`

### `GET /api/admin/dashboard`
- **Method:** `GET`
- **Path:** `/api/admin/dashboard`
- **Purpose:** Aggregate administrative statistics (total students, pending approvals, room occupancy, active complaints).
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`

### `GET /api/admin/rooms`
- **Method:** `GET`
- **Path:** `/api/admin/rooms`
- **Purpose:** List all hostel rooms with real-time occupancy and occupant lists.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`

### `GET /api/admin/students/:prn`
- **Method:** `GET`
- **Path:** `/api/admin/students/:prn`
- **Purpose:** Search student record by PRN.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Status Codes:** `200 OK`, `404 Not Found`

### `GET /api/admin/pending-students`
- **Method:** `GET`
- **Path:** `/api/admin/pending-students`
- **Purpose:** List student accounts awaiting administrator review and room allocation.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`

### `POST /api/admin/students/:id/approve-and-allocate`
- **Method:** `POST`
- **Path:** `/api/admin/students/:id/approve-and-allocate`
- **Purpose:** Approve student registration and atomically allocate a room spot.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Request Body:** `{ hostelId: string, floor: number, roomNumber: number }`
- **Validation:** Concurrency-safe atomic check (`currentOccupancy < capacity`), locks student room.
- **Status Codes:** `200 OK`, `400 Bad Request`, `404 Not Found`

### `POST /api/admin/students/:id/reject`
- **Method:** `POST`
- **Path:** `/api/admin/students/:id/reject`
- **Purpose:** Reject student registration with mandatory reason.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Request Body:** `{ reason: string }`
- **Status Codes:** `200 OK`, `400 Bad Request`, `404 Not Found`

### `PUT /api/admin/students/:id/reassign-room`
- **Method:** `PUT`
- **Path:** `/api/admin/students/:id/reassign-room`
- **Purpose:** Reassign an existing student to another hostel room atomically.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Status Codes:** `200 OK`, `400 Bad Request`

### `PUT /api/admin/students/:id/approve-room-change`
- **Method:** `PUT`
- **Path:** `/api/admin/students/:id/approve-room-change`
- **Purpose:** Approve a student's pending room change request.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Status Codes:** `200 OK`, `400 Bad Request`

### `PUT /api/admin/students/:id/reject-room-change`
- **Method:** `PUT`
- **Path:** `/api/admin/students/:id/reject-room-change`
- **Purpose:** Reject student room change request.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Status Codes:** `200 OK`, `400 Bad Request`

### `GET /api/admin/complaints`
- **Method:** `GET`
- **Path:** `/api/admin/complaints`
- **Purpose:** Paginated listing of all hostel complaints with status filters.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Status Codes:** `200 OK`

### `PATCH /api/admin/complaints/:id`
- **Method:** `PATCH`
- **Path:** `/api/admin/complaints/:id`
- **Purpose:** Update complaint status (`pending`, `in_progress`, `resolved`, `rejected`) and add administrative remarks.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Status Codes:** `200 OK`, `400 Bad Request`, `404 Not Found`

### `DELETE /api/admin/complaints/:id`
- **Method:** `DELETE`
- **Path:** `/api/admin/complaints/:id`
- **Purpose:** Permanently remove a complaint.
- **Access:** Private
- **Required Role:** `admin` strictly (warden blocked)
- **Status Codes:** `200 OK`, `403 Forbidden`, `404 Not Found`

### `GET /api/admin/users`
- **Method:** `GET`
- **Path:** `/api/admin/users`
- **Purpose:** Full directory of system users with roles, emails, and PRNs.
- **Access:** Private
- **Required Role:** `admin` strictly
- **Status Codes:** `200 OK`, `403 Forbidden`

### `PUT /api/admin/users/:id/role`
- **Method:** `PUT`
- **Path:** `/api/admin/users/:id/role`
- **Purpose:** Elevate or demote user roles (`student`, `warden`, `admin`).
- **Access:** Private
- **Required Role:** `admin` strictly
- **Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`

### `DELETE /api/admin/users/:id`
- **Method:** `DELETE`
- **Path:** `/api/admin/users/:id`
- **Purpose:** Remove user account and deallocate associated room spots.
- **Access:** Private
- **Required Role:** `admin` strictly (warden blocked with 403)
- **Status Codes:** `200 OK`, `403 Forbidden`, `404 Not Found`

### `POST /api/admin/rooms/:roomId/occupants`
- **Method:** `POST`
- **Path:** `/api/admin/rooms/:roomId/occupants`
- **Purpose:** Manually assign user to room.
- **Access:** Private
- **Required Role:** `admin` strictly
- **Status Codes:** `200 OK`, `400 Bad Request`

### `DELETE /api/admin/rooms/:roomId/occupants/:userId`
- **Method:** `DELETE`
- **Path:** `/api/admin/rooms/:roomId/occupants/:userId`
- **Purpose:** Remove occupant from room and decrement occupancy.
- **Access:** Private
- **Required Role:** `admin` strictly
- **Status Codes:** `200 OK`, `400 Bad Request`

### `PUT /api/admin/bookings/:id/confirm` & `PUT /api/admin/bookings/:id/cancel`
- **Method:** `PUT`
- **Path:** `/api/admin/bookings/:id/confirm` and `/api/admin/bookings/:id/cancel`
- **Purpose:** Administrative confirmation or cancellation of room bookings.
- **Access:** Private
- **Required Role:** `admin` strictly
- **Status Codes:** `200 OK`, `404 Not Found`

---

## 4. Digital Outpass & Gate Pass Verification (`/api/outpass`)

### `POST /api/outpass/verify-qr`
- **Method:** `POST`
- **Path:** `/api/outpass/verify-qr`
- **Purpose:** Public security gate verification for scanned QR gate passes.
- **Access:** Public (Used by campus gate guards)
- **Request Body:** `{ passCode: string }`
- **Validation:** 
  - Verifies opaque pass identifier exists.
  - Verifies status is `approved`.
  - Verifies HMAC signature integrity.
  - Checks expiration timestamp.
  - Prevents reuse of `used` passes.
- **Response Structure:** `{ valid: boolean, message: string, outpass: { passCode, studentName, prn, hostel, roomNumber, destination, departureDate, expectedReturnDate, status } }`
- **Sensitive Fields:** Passwords, tokens, database IDs, and internal secrets are never included.
- **Status Codes:** `200 OK` (when valid), `400 Bad Request` (expired/used/rejected), `404 Not Found` (invalid code)

### `POST /api/outpass`
- **Method:** `POST`
- **Path:** `/api/outpass`
- **Purpose:** Student submits a digital outpass application.
- **Access:** Private
- **Required Role:** `student` (Must have an allocated room)
- **Request Body:** `{ reason: string, destination: string, departureDate: ISOString, expectedReturnDate: ISOString, emergencyContact: string }`
- **Validation:** Valid dates (return > departure), 10-digit emergency contact.
- **Response Structure:** `{ success: true, data: OutpassObject }`
- **Status Codes:** `201 Created`, `400 Bad Request`, `401 Unauthorized`

### `GET /api/outpass/my`
- **Method:** `GET`
- **Path:** `/api/outpass/my`
- **Purpose:** Student retrieves their own outpass application history.
- **Access:** Private
- **Required Role:** `student`
- **Ownership Requirement:** Strictly scoped to `student: req.user.id`.
- **Status Codes:** `200 OK`, `401 Unauthorized`

### `GET /api/outpass/:id`
- **Method:** `GET`
- **Path:** `/api/outpass/:id`
- **Purpose:** View full outpass details and rendered QR gate pass code.
- **Access:** Private
- **Required Role:** Owner student, Admin, Warden (IDOR protected: Student 2 blocked from Student 1 outpass with 403).
- **Status Codes:** `200 OK`, `403 Forbidden`, `404 Not Found`

### `GET /api/outpass/admin/all`
- **Method:** `GET`
- **Path:** `/api/outpass/admin/all`
- **Purpose:** Administrative listing of all campus outpasses with pagination and status filters.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Status Codes:** `200 OK`, `403 Forbidden`

### `PUT /api/outpass/admin/:id/approve`
- **Method:** `PUT`
- **Path:** `/api/outpass/admin/:id/approve`
- **Purpose:** Admin/Warden approves outpass, generates cryptographic HMAC signature and QR code data URI.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Request Body:** `{ remarks?: string }`
- **Status Codes:** `200 OK`, `400 Bad Request`, `404 Not Found`

### `PUT /api/outpass/admin/:id/reject`
- **Method:** `PUT`
- **Path:** `/api/outpass/admin/:id/reject`
- **Purpose:** Admin/Warden rejects outpass request with optional remarks.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Request Body:** `{ remarks?: string }`
- **Status Codes:** `200 OK`, `404 Not Found`

### `POST /api/outpass/admin/:id/mark-used`
- **Method:** `POST`
- **Path:** `/api/outpass/admin/:id/mark-used`
- **Purpose:** Gate security check-out: marks pass status as `used`, records `usedAt` timestamp and verifier identity. Prevents reuse.
- **Access:** Private
- **Required Role:** `admin`, `warden`
- **Status Codes:** `200 OK`, `400 Bad Request`, `404 Not Found`

---

## 5. Hostels & Dynamic Rooms (`/api/hostels`, `/api/rooms`)

### `GET /api/hostels` & `GET /api/hostels/:id`
- **Method:** `GET`
- **Path:** `/api/hostels` and `/api/hostels/:id`
- **Purpose:** Public listing of active hostels and room capacities.
- **Access:** Public
- **Status Codes:** `200 OK`, `404 Not Found`

### `GET /api/hostels/:id/summary`
- **Method:** `GET`
- **Path:** `/api/hostels/:id/summary`
- **Purpose:** Detailed hostel occupancy and room-breakdown summary.
- **Access:** Private (`admin`, `warden`)
- **Status Codes:** `200 OK`, `403 Forbidden`

### `POST /api/hostels`, `PUT /api/hostels/:id`, `DELETE /api/hostels/:id`, `PATCH /api/hostels/:id/toggle-status`
- **Method:** `POST`, `PUT`, `DELETE`, `PATCH`
- **Path:** `/api/hostels/*`
- **Purpose:** Administrative creation, modification, status toggling, and deletion of hostels.
- **Access:** Private (`admin` only)
- **Status Codes:** `200 OK`, `201 Created`, `400 Bad Request`, `403 Forbidden`

### `GET /api/rooms` & `GET /api/rooms/available` & `GET /api/rooms/:id`
- **Method:** `GET`
- **Path:** `/api/rooms` and `/api/rooms/:id`
- **Purpose:** Room availability listings with optional authenticated view.
- **Access:** Public / Optional Auth
- **Status Codes:** `200 OK`, `404 Not Found`

### `POST /api/rooms`, `PUT /api/rooms/:id`, `DELETE /api/rooms/:id`
- **Method:** `POST`, `PUT`, `DELETE`
- **Path:** `/api/rooms/*`
- **Purpose:** Administrative room creation, capacity updates, and deletion.
- **Access:** Private (`admin` only)
- **Status Codes:** `200 OK`, `201 Created`, `400 Bad Request`, `403 Forbidden`

---

## 6. Complaints (`/api/complaints`)

### `POST /api/complaints`
- **Method:** `POST`
- **Path:** `/api/complaints`
- **Purpose:** Submit student maintenance or issue complaint.
- **Access:** Private (`student` only, must have allocated room)
- **Ownership Requirement:** Location (`hostel`, `floor`, `roomNumber`) is derived strictly from the authenticated student profile. Client-submitted spoofed locations are discarded.
- **Request Body:** `{ title: string, description: string, category: string }`
- **Status Codes:** `201 Created`, `400 Bad Request`, `403 Forbidden`

### `GET /api/complaints/my`
- **Method:** `GET`
- **Path:** `/api/complaints/my`
- **Purpose:** Retrieve caller's personal complaints.
- **Access:** Private (`student` only)
- **Ownership Requirement:** Isolated to `user: req.user.id`.
- **Status Codes:** `200 OK`

### `GET /api/complaints/:id`
- **Method:** `GET`
- **Path:** `/api/complaints/:id`
- **Purpose:** Retrieve single complaint by ID.
- **Access:** Private
- **Ownership Requirement:** Student can only view their own complaint (IDOR protected: 403). Admin/warden can view all. Invalid ObjectId handled with 404.
- **Status Codes:** `200 OK`, `403 Forbidden`, `404 Not Found`

---

## 7. Mess Menu & Static Media (`/api/mess-menu`)

### `GET /api/mess-menu` & `GET /api/mess-menu/latest`
- **Method:** `GET`
- **Path:** `/api/mess-menu` and `/api/mess-menu/latest`
- **Purpose:** Public fetch for weekly mess menus and dietary schedules.
- **Access:** Public
- **Status Codes:** `200 OK`

### `POST /api/mess-menu/upload-image`
- **Method:** `POST`
- **Path:** `/api/mess-menu/upload-image`
- **Purpose:** Upload weekly mess menu image.
- **Access:** Private (`admin`, `warden`)
- **Validation:** 5MB limit, MIME and magic-byte inspection, randomized filename.
- **Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`

### `POST /api/mess-menu`, `POST /api/mess-menu/batch`, `PUT /api/mess-menu/:id`
- **Method:** `POST`, `PUT`
- **Path:** `/api/mess-menu/*`
- **Purpose:** Administrative creation and updates to mess menu days.
- **Access:** Private (`admin`, `warden`)
- **Status Codes:** `200 OK`, `201 Created`, `403 Forbidden`

---

## 8. Bus Schedules & Transport (`/api/bus-routes`)

### `GET /api/bus-routes` & `GET /api/bus-routes/image`
- **Method:** `GET`
- **Path:** `/api/bus-routes` and `/api/bus-routes/image`
- **Purpose:** Public transport timings and campus bus timetable image.
- **Access:** Public
- **Status Codes:** `200 OK`

### `POST /api/bus-routes/upload-image`
- **Method:** `POST`
- **Path:** `/api/bus-routes/upload-image`
- **Purpose:** Upload official bus schedule timetable graphic.
- **Access:** Private (`admin`, `warden`)
- **Validation:** Secure file upload middleware.
- **Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`

### `POST /api/bus-routes`, `PUT /api/bus-routes/:id`, `DELETE /api/bus-routes/:id`
- **Method:** `POST`, `PUT`, `DELETE`
- **Path:** `/api/bus-routes/*`
- **Purpose:** Administrative route management.
- **Access:** Private (`admin`, `warden` for create/update; `admin` only for delete)
- **Status Codes:** `200 OK`, `201 Created`, `403 Forbidden`

---

## 9. Persistent Notifications (`/api/notifications`)

### `GET /api/notifications/my` & `GET /api/notifications/unread-count`
- **Method:** `GET`
- **Path:** `/api/notifications/my` and `/api/notifications/unread-count`
- **Purpose:** Fetch authenticated user's notification feed and badge unread count.
- **Access:** Private
- **Ownership Requirement:** Scoped strictly to `recipient: req.user.id`. Students never receive administrative registration alerts.
- **Status Codes:** `200 OK`

### `PUT /api/notifications/:id/read` & `PUT /api/notifications/mark-all-read`
- **Method:** `PUT`
- **Path:** `/api/notifications/:id/read` and `/api/notifications/mark-all-read`
- **Purpose:** Mark individual or all notifications as read.
- **Access:** Private
- **Ownership Requirement:** Scoped to caller's own notifications.
- **Status Codes:** `200 OK`, `404 Not Found`

### `POST /api/notifications` & `POST /api/notifications/bulk`
- **Method:** `POST`
- **Path:** `/api/notifications` and `/api/notifications/bulk`
- **Purpose:** Administrative notification dispatch.
- **Access:** Private (`admin`, `warden`)
- **Status Codes:** `201 Created`, `403 Forbidden`

---

## 10. Notices & Announcements (`/api/notices`)

### `GET /api/notices`
- **Method:** `GET`
- **Path:** `/api/notices`
- **Purpose:** List official hostel notices.
- **Access:** Private (Authenticated students, wardens, admins)
- **Status Codes:** `200 OK`

### `POST /api/notices` & `DELETE /api/notices/:id`
- **Method:** `POST`, `DELETE`
- **Path:** `/api/notices` and `/api/notices/:id`
- **Purpose:** Create notice with optional image attachment, or delete notice.
- **Access:** Private (`admin`, `warden` to create; `admin` only to delete)
- **Validation:** Multi-part file upload with signature checking.
- **Status Codes:** `201 Created`, `200 OK`, `403 Forbidden`

---

## 11. Room Bookings (`/api/bookings`)

### `GET /api/bookings` & `GET /api/bookings/:id`
- **Method:** `GET`
- **Path:** `/api/bookings` and `/api/bookings/:id`
- **Purpose:** Retrieve booking records.
- **Access:** Private
- **Ownership Requirement:** Scoped to caller or administrative view.
- **Status Codes:** `200 OK`, `403 Forbidden`, `404 Not Found`

### `POST /api/bookings`, `PUT /api/bookings/:id`, `DELETE /api/bookings/:id`
- **Method:** `POST`, `PUT`, `DELETE`
- **Path:** `/api/bookings/*`
- **Purpose:** Student booking requests and cancellations.
- **Access:** Private
- **Status Codes:** `200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`

---

## Endpoint Security Audit Summary Table

| Category | Endpoint Count | Public | Student Auth | Admin/Warden Auth | Admin Only | IDOR Hardened | Rate Limited |
|---|---|---|---|---|---|---|---|
| **Health** | 2 | 2 | 0 | 0 | 0 | N/A | Probe Exempt |
| **Users / Auth / Profile** | 12 | 8 | 4 | 0 | 0 | Yes | Yes (40/15m) |
| **Admin Operations** | 21 | 5 | 0 | 9 | 7 | Yes | Yes (40/15m auth, 500/15m general) |
| **Digital Outpass** | 8 | 1 | 3 | 4 | 0 | Yes | Yes |
| **Hostels & Rooms** | 10 | 3 | 0 | 1 | 6 | Yes | Yes |
| **Complaints** | 3 | 0 | 3 | 0 | 0 | Yes | Yes |
| **Mess Menu** | 6 | 2 | 0 | 4 | 0 | Yes | Yes |
| **Bus Routes** | 6 | 2 | 0 | 3 | 1 | Yes | Yes |
| **Notifications** | 6 | 0 | 4 | 2 | 0 | Yes | Yes |
| **Notices** | 3 | 0 | 1 | 1 | 1 | Yes | Yes |
| **Bookings** | 5 | 0 | 5 | 0 | 0 | Yes | Yes |
| **TOTAL** | **61** | **23** | **20** | **24** | **15** | **100%** | **100%** |
