#  Hostel Management System (Symbiosis HMS)

[![Tests](https://img.shields.io/badge/Tests-178%2F178%20Passing-brightgreen.svg)](TESTING.md)
[![Security](https://img.shields.io/badge/Security-OWASP%20Hardened-blue.svg)](SECURITY.md)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-cyan.svg)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas-forestgreen.svg)](DATABASE.md)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-grade, production-hardened full-stack Hostel Management System designed for educational institutions and campus housing. Built with a decoupled **React 18 + Vite** frontend and a robust **Node.js + Express** REST API backend backed by **MongoDB Atlas**.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Key Features](#key-features)
4. [Tech Stack](#tech-stack)
5. [Prerequisites](#prerequisites)
6. [Installation & Setup](#installation--setup)
7. [Environment Variables](#environment-variables)
8. [Database Setup](#database-setup)
9. [Email Provider Setup (Phase 8 Abstraction)](#email-provider-setup)
10. [Local Development](#local-development)
11. [Running the Automated Tests](#running-the-automated-tests)
12. [Docker Deployment](#docker-deployment)
13. [Zero-Cost Cloud Deployment](#zero-cost-cloud-deployment)
14. [Security & Protection Controls](#security--protection-controls)
15. [Performance Benchmarks](#performance-benchmarks)

---

## Project Overview

Managing student housing, room allocations, grievances, dining schedules, and campus transport requires strict operational invariants:
- **Zero Double-Bookings:** Concurrency-safe atomic database conditions prevent overbooking beyond physical room capacity.
- **Institutional Identity Verification:** Cryptographic email verification enforces valid university emails before administration reviews and admits students.
- **Role-Based Access Control (RBAC):** Strict separation between student portals, warden desks, and administrator controls.
- **IDOR & Mass Assignment Defenses:** Students are cryptographically prevented from viewing or modifying other students' complaints, rooms, or payment records.

---

## Architecture

The application adopts a clean, layered client-server architecture:

```
[Browser / Mobile Web]
         │
         ▼
[React 18 + Vite SPA Frontend (hostel-compass)]  <-- Port 8080
         │  (HTTPS / HttpOnly Session Cookie / REST)
         ▼
[Express 4.19 Node API Gateway (backend)]         <-- Port 5000
   ├── Helmet & CORS Security Pipeline
   ├── Rate Limiters (Auth & General)
   ├── NoSQL Sanitizer & Magic-Byte Upload Validator
   ├── JWT Dual-Token Authentication Middleware
   └── Domain Services (Auth, Rooms, Complaints, Notices, Email)
         │
         ▼
[MongoDB Atlas Replica Set]                       <-- Cloud Persistence
```

For complete technical details, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Key Features

- **Multi-Stage Student Onboarding:** Registration -> Tokenized Email Verification -> Administrative Review & Room Allocation -> Portal Access.
- **Hardened Authentication:** Bcrypt password hashing, HttpOnly session cookies, brute-force rate limiting, and dual Bearer token support.
- **Dynamic Hostels & Rooms:** Full hierarchy supporting multiple hostels, floors, and variable room capacities (Single to Dormitory).
- **Complaint Management Engine:** Students file categorized maintenance grievances with automated location tagging; admins route tickets to specialized departments (Electrician, Plumber, Housekeeping) with audit notes.
- **Weekly Mess Menu:** Admin upload with magic-byte file signature validation and instant student dashboard viewing.
- **Campus Bus Routes:** Dynamic transit timings, route sequences, and printable timetable assets.
- **Persistent Notifications:** Role-aware and student-targeted real-time alerts with unread badge counters.

---

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Shadcn UI, TanStack Query.
- **Backend:** Node.js v20+, Express.js, Mongoose 8.x, JWT (`jsonwebtoken`), Bcrypt.js, Multer, Helmet, Express-Rate-Limit.
- **Database:** MongoDB Atlas (M0 Free Tier compatible) / Local MongoDB.
- **Email:** Nodemailer abstraction supporting SMTP, Brevo, Resend, and Ethereal (local dev).
- **Containerization:** Multi-stage production Dockerfiles with Alpine Linux & Nginx.

---

## Prerequisites

- **Node.js:** v20.x or v22.x LTS ([Download](https://nodejs.org/))
- **npm:** v10.x+
- **MongoDB:** MongoDB Atlas free connection string or local MongoDB v6.x+
- **Docker:** (Optional) Docker Desktop v24+ for containerized execution

---

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/Hostel-Management-System.git
cd "Hostel Management System"
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies
```bash
cd ../hostel-compass
npm install
```

---

## Environment Variables

Copy the sanitized `.env.example` file to create your local `.env`:

```bash
# In backend directory:
cp .env.example .env
```

Configure your variables in `backend/.env`:
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/symbiosis_hms?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRE=30d
APP_BASE_URL=http://localhost:8080
FRONTEND_URL=http://localhost:8080
REQUIRE_EMAIL_VERIFICATION=false

# Email Configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_smtp_login
SMTP_PASSWORD=your_smtp_password
MAIL_FROM= HMS <noreply@your-domain.com>
```

> **Security Note:** Never commit `.env` to version control. See [SECURITY.md](SECURITY.md).

---

## Database Setup

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Whitelist your IP (or `0.0.0.0/0` for cloud deployment).
3. Paste the connection string into `backend/.env`.
4. Run the seed script to create initial admin and warden accounts:
   ```bash
   cd backend
   node seed.js
   ```

For detailed schema structures and index definitions, see [DATABASE.md](DATABASE.md).

---

## Email Provider Setup

The application features a clean email service abstraction (`backend/services/emailService.js`):
- **Development (Zero-Config):** Leave `EMAIL_PROVIDER=ethereal`. Verification links will automatically generate Ethereal preview URLs in the console.
- **Production (Free Brevo Tier):** Set `EMAIL_PROVIDER=smtp` and configure `SMTP_HOST=smtp-relay.brevo.com` (free 300 emails/day).
- **Production (Resend):** Set `EMAIL_PROVIDER=resend`.

For details on quotas and setup, see [EXTERNAL_SERVICES.md](EXTERNAL_SERVICES.md).

---

## Local Development

You can start both backend and frontend servers:

### Terminal 1 (Backend API):
```bash
cd backend
npm run dev
# Running on http://localhost:5000
```

### Terminal 2 (Frontend SPA):
```bash
cd hostel-compass
npm run dev
# Running on http://localhost:8080
```

---

## Running the Automated Tests

The repository includes **116 automated tests** spanning 8 test suites:

```bash
cd backend
npm run test
```

### Individual Test Suites:
```bash
# Base 40-Point Security & Allocation Invariants
node tests/verify-all.js

# Phase 1: Admin Auth & Complaint System
node tests/phase1-admin-auth.test.js

# Phase 2: Dynamic Hostels & Rooms
node tests/phase2-dynamic-hostel-rooms.test.js

# Phase 3: Persistent Notifications
node tests/phase3-notifications.test.js

# Phase 4: Mess Menu & Static Assets
node tests/phase4-mess-menu.test.js

# Phase 5: Auth Hardening & HttpOnly Cookies
node tests/phase5-auth-security.test.js

# Phase 6: Student Email Verification
node tests/phase6-email-verification.test.js

# Phase 7: Password Reset Hardening
node tests/phase7-password-reset-hardening.test.js
```

See [TESTING.md](TESTING.md) for complete details.

---

## Docker Deployment

The application provides production Dockerfiles and a `docker-compose.yml`:

```bash
# Build and run containers in background
docker compose up --build -d

# Verify container health
docker compose ps

# View application logs
docker compose logs -f backend
```

---

## Zero-Cost Cloud Deployment

Deploy the system at zero infrastructure cost:
- **Frontend:** Cloudflare Pages (Free global edge CDN, unlimited bandwidth).
- **Backend:** Render Free Web Service (Node.js 20).
- **Database:** MongoDB Atlas M0 (Free 512 MB replica set).
- **Email:** Brevo Free Tier (300 emails/day).

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions.

---

## Security & Protection Controls

- **Magic-Byte Upload Validation:** JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), and WebP (`52 49 46 46` ... `57 45 42 50`) file signatures inspected before write; disguised executables deleted instantly.
- **NoSQL Injection Defense:** Recursive sanitization strips `$` and `.` from query objects.
- **Rate Limiting:** Auth endpoints capped at 40 requests/15m; general API capped at 500 requests/15m.
- **Enumeration Safe:** Password reset and verification resend return identical responses for existing and non-existing accounts.

See [SECURITY.md](SECURITY.md) for full audit reports.

---

## Performance Benchmarks

Actual empirical load test results on single Node process:
- **Throughput:** 2,449.91 Avg Req/Sec (Peak: 3,091 Req/Sec).
- **p50 Latency:** 19 ms.
- **p99 Latency:** 94 ms.
- **Error Rate:** 0.00% server errors; rate limiters properly throttle excess traffic.

See [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md) for the complete benchmark analysis.
