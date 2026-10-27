# API Reference Documentation

Base URL: `http://localhost:5000/api` (or configured `APP_BASE_URL`)

All protected endpoints require either:
- Cookie: `token=<jwt>` (HttpOnly cookie set automatically on login)
- Header: `Authorization: Bearer <token>`

---

## 1. Authentication & Student Identity (`/api/users`)

### `POST /api/users/register`
- **Access:** Public
- **Description:** Register a new student account.
- **Request Body:**
  ```json
  {
    "firstName": "Adarsh",
    "lastName": "Jha",
    "email": "student@sitpune.edu.in",
    "password": "StrongPassword123!",
    "prn": "21070122001",
    "phone": "9876543210"
  }
  ```
- **Responses:**
  - `201 Created`: Account created. If verification enabled, status is unverified; email sent.
  - `400 Bad Request`: Validation error or duplicate email/PRN/phone.

### `POST /api/users/login`
- **Access:** Public
- **Description:** Authenticate student credentials and receive JWT cookie & token.
- **Request Body:** `{ "email": "student@sitpune.edu.in", "password": "StrongPassword123!" }`
- **Responses:**
  - `200 OK`: Sets `token` cookie; returns user profile and JWT.
  - `401 Unauthorized`: Invalid credentials.
  - `403 Forbidden`: Account pending approval or unverified email.

### `POST /api/users/verify-email`
- **Access:** Public
- **Description:** Validate single-use 64-char hex token.
- **Request Body:** `{ "token": "64_char_hex_token" }`
- **Responses:**
  - `200 OK`: `{ "success": true, "message": "Email verified successfully..." }`
  - `400 Bad Request`: Invalid, expired, or reused token.

### `POST /api/users/resend-verification`
- **Access:** Public (Rate limited: 60s cooldown)
- **Request Body:** `{ "email": "student@sitpune.edu.in" }`
- **Responses:**
  - `200 OK`: Generic safe response.
  - `429 Too Many Requests`: Cooldown active.

### `POST /api/users/forgot-password`
- **Access:** Public
- **Request Body:** `{ "email": "student@sitpune.edu.in" }`
- **Responses:**
  - `200 OK`: `{ "success": true, "message": "If an account exists, a link has been sent." }`

### `POST /api/users/reset-password/:token`
- **Access:** Public
- **Request Body:** `{ "password": "NewStrongPassword123!" }`
- **Responses:**
  - `200 OK`: Password reset; old password invalidated.
  - `400 / 401`: Invalid, expired, or reused token.

---

## 2. Admin Authentication & Management (`/api/admin`)

### `POST /api/admin/login`
- **Access:** Public (Admin / Warden emails only)
- **Request Body:** `{ "email": "admin@symbiosis.ac.in", "password": "AdminPassword123!" }`
- **Responses:**
  - `200 OK`: Sets HttpOnly admin cookie.
  - `403 Forbidden`: Student emails strictly blocked.

### `GET /api/admin/dashboard`
- **Access:** Private (Admin / Warden)
- **Description:** Return system metrics: total students, approved/pending count, hostel occupancy, complaint counts.

### `GET /api/admin/pending-students`
- **Access:** Private (Admin / Warden)
- **Description:** List students awaiting room allocation with pagination.

### `POST /api/admin/students/:id/approve-and-allocate`
- **Access:** Private (Admin / Warden)
- **Request Body:**
  ```json
  {
    "hostel": "Hostel Alpha",
    "roomNumber": "101",
    "floor": "1"
  }
  ```
- **Responses:**
  - `200 OK`: Student status set to `approved`; atomic room occupant added.
  - `400 Bad Request`: Unverified student (when policy enabled) or room at capacity.

### `POST /api/admin/students/:id/reject`
- **Access:** Private (Admin / Warden)
- **Request Body:** `{ "reason": "Documentation mismatch" }`

### `PUT /api/admin/students/:id/reassign-room`
- **Access:** Private (Admin / Warden)
- **Request Body:** `{ "hostel": "Hostel Beta", "roomNumber": "205", "floor": "2" }`

---

## 3. Student Complaints (`/api/complaints`)

### `POST /api/complaints`
- **Access:** Private (Student)
- **Request Body:**
  ```json
  {
    "title": "Leaking faucet in bathroom",
    "description": "Bathroom faucet continuously leaking on floor 2.",
    "category": "plumbing"
  }
  ```
- **Note:** Student hostel, floor, and roomNumber are injected server-side from session to prevent tampering.

### `GET /api/complaints/my`
- **Access:** Private (Student)
- **Description:** List authenticated student's complaints with real-time admin resolution status.

### `GET /api/admin/complaints`
- **Access:** Private (Admin / Warden)
- **Query Params:** `?page=1&limit=50&status=pending&hostel=Hostel Alpha`

### `PATCH /api/admin/complaints/:id`
- **Access:** Private (Admin / Warden)
- **Request Body:**
  ```json
  {
    "status": "in_progress",
    "assignedDepartment": "plumber",
    "adminNotes": "Plumber dispatched at 10:00 AM."
  }
  ```

---

## 4. Mess Menu & Static Assets (`/api/mess-menu`)

### `GET /api/mess-menu/latest`
- **Access:** Public
- **Description:** Returns the active weekly mess schedule and uploaded image URL.

### `POST /api/mess-menu/upload-image`
- **Access:** Private (Admin / Warden)
- **Headers:** `Content-Type: multipart/form-data`
- **Payload:** `file` (JPG, PNG, or WebP; validated via magic-bytes)
- **Responses:**
  - `200 OK`: `{ "success": true, "imageUrl": "/uploads/mess-menu/..." }`
  - `400 Bad Request`: Executable or invalid magic bytes.

---

## 5. Bus Routes & Schedule (`/api/bus-routes`)

### `GET /api/bus-routes`
- **Access:** Public
- **Description:** Returns campus transit schedule, timings, and stop sequences.

### `POST /api/bus-routes`
- **Access:** Private (Admin / Warden)
- **Request Body:**
  ```json
  {
    "routeNumber": "Route 4",
    "departureTime": "08:15 AM",
    "startPoint": "Symbiosis Hostel Campus",
    "endPoint": "SIT Main Academic Block",
    "stops": ["Hostel Gate", "Library Circle", "Sports Complex", "Academic Block"]
  }
  ```

---

## 6. Notifications (`/api/notifications`)

### `GET /api/notifications/my`
- **Access:** Private (All logged in users)
- **Description:** Retrieve targeted user and role-specific notifications.

### `GET /api/notifications/unread-count`
- **Access:** Private
- **Description:** Fast unread badge counter.

### `PUT /api/notifications/:id/read`
- **Access:** Private
- **Description:** Mark individual notification as read.

---

## 7. Digital Outpass & Gate Pass System (`/api/outpass`)

### `POST /api/outpass`
- **Access:** Private (Approved student with assigned room)
- **Description:** Submit an outpass application.
- **Request Body:**
  ```json
  {
    "reason": "Family function",
    "destination": "Mumbai",
    "departureDate": "2026-10-05T08:00:00.000Z",
    "expectedReturnDate": "2026-10-06T20:00:00.000Z",
    "emergencyContact": "9876543210"
  }
  ```
- **Responses:**
  - `201 Created`: Application submitted with status `pending`.

### `GET /api/outpass/my`
- **Access:** Private (Student)
- **Description:** Retrieve student's own outpass applications.

### `GET /api/outpass/:id`
- **Access:** Private (Owner student, Admin, Warden — IDOR protected)
- **Description:** Retrieve single outpass details and rendered QR gate pass data URI.

### `GET /api/outpass/admin/all`
- **Access:** Private (Admin / Warden)
- **Description:** Paginated listing of all campus outpasses with status filters.

### `PUT /api/outpass/admin/:id/approve`
- **Access:** Private (Admin / Warden)
- **Description:** Approve outpass and generate HMAC-SHA256 signed opaque pass code (`OP-...`) and QR image data URI.

### `PUT /api/outpass/admin/:id/reject`
- **Access:** Private (Admin / Warden)
- **Description:** Reject outpass with remarks.

### `POST /api/outpass/verify-qr`
- **Access:** Public (Used by campus security gate)
- **Description:** Scan and verify digital gate pass QR code.
- **Request Body:** `{ "passCode": "OP-71B0780ECF1AE199" }`
- **Responses:**
  - `200 OK`: Valid gate pass details (zero private secrets exposed).
  - `400 Bad Request`: Expired, rejected, or already-used pass.
  - `404 Not Found`: Invalid or forged pass code.

### `POST /api/outpass/admin/:id/mark-used`
- **Access:** Private (Admin / Warden / Security)
- **Description:** Gate check-out: records departure, marks pass as `used`, and prevents pass reuse.

---

## 8. Notices & Announcements (`/api/notices`)

### `GET /api/notices`
- **Access:** Private (Authenticated students, wardens, admins)
- **Description:** List official hostel announcements.

### `POST /api/notices`
- **Access:** Private (Admin / Warden)
- **Description:** Publish a new campus notice with optional image attachment.

### `DELETE /api/notices/:id`
- **Access:** Private (Admin only)
- **Description:** Remove a published notice.

