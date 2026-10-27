# Architecture Documentation

## 1. System Architecture Overview

The Symbiosis Hostel Management System (Symbiosis HMS) is designed as a decoupled full-stack web application with strict separation of concerns, defense-in-depth security, and database isolation.

```
┌────────────────────────────────────────────────────────┐
│                   CLIENT LAYER (SPA)                   │
│  React 18 + Vite + TypeScript + TailwindCSS + ShadcnUI │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS (REST + Cookies)
┌──────────────────────────▼─────────────────────────────┐
│                 APPLICATION GATEWAY / API              │
│               Node.js 20+ / Express 4.19               │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Security Middleware Pipeline                     │  │
│  │  - Helmet (CSP, CORS headers)                    │  │
│  │  - Express Rate Limiter (IP auth/general caps)   │  │
│  │  - NoSQL Injection Sanitizer (Recursion clean)   │  │
│  │  - Cookie Parser & Bearer Dual-Token Authenticator│ │
│  │  - Role-Based Access Control (Admin/Warden/Stud) │  │
│  │  - Magic-Byte File Signature Validator           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Controllers & Business Services                  │  │
│  │  - Auth & Cryptographic Email Verification       │  │
│  │  - Admin Approval & Concurrency Room Allocator   │  │
│  │  - Complaint Escalation Engine                   │  │
│  │  - Notification Dispatcher (Role & User-aware)   │  │
│  │  - Mess Menu & Static Asset Delivery Service     │  │
│  │  - Email Provider Abstraction (SMTP/Brevo/Resend)│  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────┬─────────────────────────────┘
                           │ Mongoose 8.x / TCP (TLS)
┌──────────────────────────▼─────────────────────────────┐
│                   PERSISTENCE LAYER                    │
│             MongoDB Atlas (Replica Set / M0)           │
│                                                        │
│  - Users (PRN/email unique, hashed tokens, roles)      │
│  - Hostels & Rooms (Scoped compound index: hostel+room)│
│  - Complaints (User & status indexed, admin notes)     │
│  - Notifications (Role, user, unread status indexed)   │
│  - Bookings & Mess Menus (Weekly schedules & images)   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Key Architectural Invariants

### 1. Dual-Token Authentication & HttpOnly Cookie Security
- Authentication tokens are issued as JSON Web Tokens (JWT) signed with SHA-256 HMAC (`JWT_SECRET`).
- Tokens are set in modern browsers as `HttpOnly`, `SameSite=Strict`, `Secure` (in production) cookies, mitigating Cross-Site Scripting (XSS) token theft.
- For non-browser or programmatic API consumers, standard `Authorization: Bearer <token>` headers are supported simultaneously.

### 2. Multi-Stage Student Registration & Approval
1. Student registers -> Account status initialized as `pending`, `isEmailVerified: false`.
2. A 32-byte cryptographically secure random token is generated; its SHA-256 hash is saved with a 24-hour expiration.
3. Verification link is dispatched via Email Service abstraction.
4. Student confirms email -> `isEmailVerified` transitions to `true`.
5. Administrator reviews student credentials (PRN, batch, department) and assigns a room from available capacity.
6. Only once `isEmailVerified === true` AND `status === 'approved'` can the student log into the portal.

### 3. Concurrency-Safe Room Allocation
- Room capacity is maintained through atomic Mongoose conditions (`$expr: { $lt: [{ $size: '$occupants' }, '$capacity'] }`) and `$addToSet`.
- Virtual fields (`availableSpots`, `occupied`) compute real-time capacity without stale cache race conditions.
- Compound unique indexes `{ hostel: 1, roomNumber: 1 }` prevent duplicate rooms within a hostel.

### 4. Role-Based Access Control (RBAC) Matrix
| Route Group | Student | Warden | Admin | Unauthenticated |
| :--- | :---: | :---: | :---: | :---: |
| Public Static Assets (`/uploads/*`) | Read | Read | Read | Read |
| Mess Menus / Bus Routes | Read | Read / Write | Read / Write | Read |
| Student Complaints (`/api/complaints/my`) | Read / Create Own | All Complaints | All Complaints | No Access |
| Room Allocations / Approval | No Access | Read / Allocate | Read / Allocate / Admin | No Access |
| Admin Dashboard & Metrics | No Access | Read | Read / Full Access | No Access |
| User Role Mutation & Deletion | No Access | No Access | Read / Write | No Access |

### 5. File Upload Security Architecture
1. Request hits `multer` storage middleware.
2. File extension and MIME type are strictly validated against an allowlist (`.jpg`, `.jpeg`, `.png`, `.webp`).
3. Filenames are regenerated with `crypto.randomUUID()` to prevent path traversal or file overwrites.
4. `verifyUploadedFileSignature` middleware reads the initial 12 magic bytes directly from disk:
   - JPEG: `FF D8 FF`
   - PNG: `89 50 4E 47`
   - WebP: `52 49 46 46` ... `57 45 42 50`
5. If the file signature fails verification, the file is unlinked immediately and HTTP 400 is returned.
