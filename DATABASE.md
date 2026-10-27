# Database Architecture & Schema Specifications

## 1. Overview

The Symbiosis Hostel Management System utilizes **MongoDB** as its primary persistence engine, accessed through **Mongoose 8.x** Object Document Mapper (ODM).

The database architecture is designed for operational concurrency, high read/write performance for ~1,000+ active students, and data integrity via compound indexes and schema validation.

---

## 2. Connection Pool Configuration (`backend/config/database.js`)

```javascript
const conn = await mongoose.connect(mongoURI, {
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 45000,
  maxPoolSize: 50,  // Supports concurrent HTTP requests under peak registration load
  minPoolSize: 5,   // Keeps persistent connection pool warm to prevent cold-query lag
});
```

---

## 3. Collections & Indexing Analysis

### A. `users` Collection
Stores student profiles, wardens, and system administrators.
- **Key Fields:**
  - `email`: `String`, unique, lowercase, trimmed, required.
  - `prn`: `String`, unique, sparse, trimmed (Symbiosis Permanent Registration Number).
  - `phone`: `String`, unique, sparse.
  - `role`: `enum: ['student', 'warden', 'admin']`, default: `'student'`.
  - `status`: `enum: ['pending', 'approved', 'rejected']`, default: `'pending'`.
  - `isEmailVerified`: `Boolean`, default: `false`.
  - `emailVerificationToken`: `String`, hashed SHA-256 token, `select: false`.
  - `resetPasswordToken`: `String`, hashed SHA-256 token, `select: false`.
- **Indexes:**
  | Index Spec | Type | Rationale |
  | :--- | :--- | :--- |
  | `{ email: 1 }` | Unique | Fast student/admin login lookups; duplicate prevention. |
  | `{ prn: 1 }` | Unique, Sparse | Fast student lookup by PRN; allows admin accounts without PRN. |
  | `{ phone: 1 }` | Unique, Sparse | Duplicate phone registration prevention. |
  | `{ hostel: 1, roomNumber: 1 }` | Compound | Fast student room occupancy queries and directory lookups. |
  | `{ role: 1, createdAt: -1 }` | Compound | Admin dashboard student filtering. |
  | `{ status: 1, createdAt: -1 }` | Compound | Pending student approval queue pagination. |
  | `{ emailVerificationToken: 1 }` | Single | Token verification lookup. |
  | `{ resetPasswordToken: 1 }` | Single | Password reset token lookup. |

---

### B. `hostels` Collection
Represents dynamic hostel blocks on campus.
- **Key Fields:** `name` (unique), `description`, `address`, `floors`, `isActive`, `phone`, `email`.
- **Indexes:** `{ name: 1 }` (unique).

---

### C. `rooms` Collection
Manages physical rooms, floor numbers, occupancy limits, and assigned students.
- **Key Fields:**
  - `hostel`: `ObjectId` referencing `Hostel`.
  - `roomNumber`: `String` (e.g., "101", "204B").
  - `floor`: `Number`, min: 0.
  - `capacity`: `Number`, default: 3.
  - `occupants`: Array of `ObjectId` referencing `User`.
  - `status`: `enum: ['AVAILABLE', 'FULL', 'MAINTENANCE']`.
- **Indexes:**
  | Index Spec | Type | Rationale |
  | :--- | :--- | :--- |
  | `{ hostel: 1, roomNumber: 1 }` | **Compound Unique** | Prevents duplicate room numbers within the same hostel block. |
  | `{ hostel: 1, floor: 1 }` | Compound | Hierarchical floor filtering in admin allocation UI. |
  | `{ hostel: 1, status: 1 }` | Compound | Real-time vacancy searches. |

---

### D. `complaints` Collection
Tracks student maintenance and grievance requests.
- **Key Fields:** `user` (ref: User), `title`, `description`, `category`, `hostel`, `roomNumber`, `status` (`pending`, `in_progress`, `resolved`, `rejected`), `assignedDepartment`, `adminNotes`.
- **Indexes:**
  | Index Spec | Type | Rationale |
  | :--- | :--- | :--- |
  | `{ user: 1, createdAt: -1 }` | Compound | Student "My Complaints" feed (IDOR-safe fast load). |
  | `{ status: 1, createdAt: -1 }` | Compound | Admin queue resolution filtering. |
  | `{ hostel: 1, roomNumber: 1 }` | Compound | Room maintenance history. |

---

### E. `notifications` Collection
Provides persistent role-aware and user-targeted notifications.
- **Key Fields:** `userId` (optional), `recipientRole`, `entityId`, `entityType`, `title`, `message`, `type`, `read`, `readBy`.
- **Indexes:**
  | Index Spec | Type | Rationale |
  | :--- | :--- | :--- |
  | `{ userId: 1, createdAt: -1 }` | Compound | User notification inbox ordering. |
  | `{ recipientRole: 1, createdAt: -1 }` | Compound | Role-wide broadcasts (wardens, admins, students). |
  | `{ userId: 1, read: 1 }` | Compound | Unread count badge calculation. |

---

### F. `outpasses` Collection
Tracks digital outpass requests, HMAC signatures, approval workflows, and gate check-outs.
- **Key Fields:**
  - `student`: `ObjectId` referencing `User` (required).
  - `passCode`: `String`, unique, sparse (e.g. "OP-71B0780ECF1AE199").
  - `signature`: `String`, HMAC-SHA256 signature for tamper-proofing.
  - `status`: `enum: ['pending', 'approved', 'rejected', 'used', 'expired']`, default: `'pending'`.
  - `departureDate`: `Date`, required.
  - `expectedReturnDate`: `Date`, required.
  - `actualReturnDate`: `Date`.
  - `destination`: `String`, required.
  - `reason`: `String`, required.
  - `emergencyContact`: `String`, required.
  - `approvedBy`: `ObjectId` referencing `User`.
  - `usedAt`: `Date`, timestamp when gate security marks pass as checked out.
- **Indexes:**
  | Index Spec | Type | Rationale |
  | :--- | :--- | :--- |
  | `{ passCode: 1 }` | Unique, Sparse | Fast gate QR scan verification. |
  | `{ student: 1, createdAt: -1 }` | Compound | Student "My Outpasses" listing. |
  | `{ status: 1, createdAt: -1 }` | Compound | Administrative queue filtering and pagination. |

---

## 4. Concurrency & Race Condition Defenses

### Concurrency-Safe Room Allocation
When allocating rooms to students:
```javascript
const room = await Room.findOneAndUpdate(
  {
    hostel: hostelId,
    $expr: { $lt: [{ $size: '$occupants' }, '$capacity'] }
  },
  { $addToSet: { occupants: studentId } },
  { new: true }
);
```
- `$expr: { $lt: [{ $size: '$occupants' }, '$capacity'] }`: Evaluated atomically by the MongoDB storage engine. Even if two administrators click "Approve" simultaneously, only one write will succeed if one spot remains.
- `$addToSet`: Guarantees idempotency; a student cannot be added twice to the same room array.
