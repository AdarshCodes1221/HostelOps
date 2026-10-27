# Security Policy & Hardening Specifications

## 1. Security Overview & Threat Model

The Symbiosis Hostel Management System implements defense-in-depth protection across all application boundaries. The security posture is audited against the OWASP Top 10 vulnerabilities.

---

## 2. Implemented Defense Controls

### A. Authentication & Session Security
- **Bcrypt Password Hashing:** User passwords are never stored in plaintext. They are hashed using `bcryptjs` with an adaptive work factor (salt rounds: 10).
- **HttpOnly Cookies:** JWT tokens are issued via `HttpOnly`, `SameSite=Strict`, `Path=/` cookies to block XSS credential exfiltration.
- **Dual Support:** Programmatic clients can continue to authenticate via `Authorization: Bearer <token>` headers.
- **Immediate De-Authentication:** Password reset immediately invalidates old password tokens and forces re-authentication.

### B. Cryptographic Tokens & Reset Hardening (Phases 6 & 7)
- **Token Generation:** All email verification and password reset tokens are generated using `crypto.randomBytes(32).toString('hex')` (256 bits of cryptographic entropy).
- **Hashed Storage:** Raw tokens are **never** stored in the database or logged in application traces. Only the SHA-256 hex digest is persisted:
  ```javascript
  const resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  ```
- **Single-Use Enforcement:** Upon successful verification or password reset, the token and expiry fields are immediately unset in MongoDB (`$unset: { resetPasswordToken: 1, resetPasswordExpire: 1 }`). Reusing a token immediately returns HTTP 400/401.
- **Strict Format Validation:** Tokens are validated against regex `^[0-9a-f]{64}$` before database queries, preventing NoSQL object injection or buffer issues.
- **Enumeration Protection:** Both `POST /api/users/forgot-password` and `POST /api/admin/forgot-password` return generic responses (`"If an account exists, a link has been sent"`) regardless of whether the email is registered.
- **Resend Cooldown:** Verification email resends are rate-limited with a mandatory 60-second cooldown per account.

### C. Authorization & IDOR (Insecure Direct Object Reference) Prevention
- **Role Isolation:** Routes are safeguarded with `protect` and `authorize('admin', 'warden', 'student')`.
- **Student Ownership Invariant:** Student complaint queries and booking cancellations strictly enforce ownership matching:
  ```javascript
  if (req.user.role === 'student' && complaint.user._id.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  ```
- **Mass Assignment Defenses:** On booking updates, students are strictly forbidden from modifying room numbers, prices, or payment statuses (HTTP 403). Location fields on complaints are populated strictly from the authenticated student profile (`req.user.hostel`, `req.user.roomNumber`) rather than user input.

### D. NoSQL Injection & Request Sanitization
- All incoming requests (`req.body`, `req.query`, `req.params`) pass through `mongoSanitize` middleware which recursively strips any key beginning with `$` or containing `.` characters.
- Query parameters are type-cast and validated before Mongoose execution.

### E. Rate Limiting Defenses
Configured via `express-rate-limit`:
| Scope | Window | Max Requests | Behavior on Exceeded |
| :--- | :--- | :--- | :--- |
| **Auth Endpoints** (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/resend-verification`) | 15 minutes | 40 per IP | HTTP 429 Too Many Requests |
| **General API Routes** (`/api/*`) | 15 minutes | 500 per IP | HTTP 429 Too Many Requests |

### F. File Upload Security & Magic-Byte Validation (Phase 12)
- **Extension & MIME Allowlist:** Only `.jpg`, `.jpeg`, `.png`, and `.webp` are permitted.
- **File Signature (Magic Bytes) Verification:** Upon upload, `verifyUploadedFileSignature` inspects the initial 12 bytes:
  - JPEG: `FF D8 FF`
  - PNG: `89 50 4E 47`
  - WebP: `52 49 46 46` ... `57 45 42 50`
- If magic bytes fail (e.g. executable disguised as an image), the file is **unlinked from disk immediately** and rejected with HTTP 400.
- **Filename Sanitization:** Files are renamed using `crypto.randomUUID()` to prevent path traversal (`../../etc/passwd`).
- **File Size Limit:** Capped at 5 MB per upload.

### G. Digital Gate Pass & QR Security (Phase 13)
- **Opaque Pass Code:** Gate passes use randomized opaque identifiers (`OP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`) rather than database IDs, preventing enumeration.
- **HMAC-SHA256 Cryptographic Signatures:** Every gate pass payload is signed using an HMAC-SHA256 signature generated with the server's `JWT_SECRET`. Tampering with pass data invalidates the signature.
- **Zero-Secret QR Data:** Scanned QR payloads and public verification responses contain zero personal secrets, passwords, tokens, or raw database keys.
- **Strict Single-Use & Anti-Passback Protection:** Upon checkout at the campus gate, the pass is atomically marked as `used`. Subsequent scans are immediately rejected (HTTP 400), preventing pass reuse or unauthorized re-entry.
- **Time-Bounded Expiry:** Passes expire automatically after their scheduled `expectedReturnDate`.

---

## 3. Reporting a Vulnerability

If you discover a security vulnerability in this project:
1. Please do not open a public issue.
2. Email details to: `security@sitpune.edu.in` or the project administrator.
3. Vulnerabilities will be triaged and addressed with high priority.
