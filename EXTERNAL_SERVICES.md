# External Services & API Key Audit

This document provides a transparent audit of all third-party services, APIs, and external infrastructure used or supported by the **Symbiosis Hostel Management System (Symbiosis HMS)**.

> **Zero-Cost Architectural Principle:**
> Features that operate reliably without external API dependencies are kept local and self-contained. No paid services or mandatory third-party subscriptions are required to run the core application.

---

## 1. Inventory of External Services

### 1. MongoDB Atlas
- **Purpose:** Primary document database for users, rooms, hostels, complaints, bookings, notifications, notices, and mess menus.
- **Required?:** **Yes** (or a local MongoDB instance).
- **Free Option?:** **Yes**. MongoDB Atlas **M0 Sandbox** provides 512 MB storage, shared RAM, and replica sets with zero cost forever.
- **Environment Variables:** `MONGO_URI`
- **Where to Get Credential:** [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) (Create free cluster -> Database Access -> Connect).
- **Development Mode:** Supports local `mongodb://127.0.0.1:27017/hostel_db` or Atlas sandbox.
- **Production Mode:** MongoDB Atlas M0 (Free Tier) or M10+ for dedicated resources.

---

### 2. Transactional Email Provider (Email Service Abstraction)
- **Purpose:** Cryptographic student email verification, password reset tokens, and administrative notification delivery.
- **Required?:** **Yes** in production; optional in development.
- **Free Option?:** **Yes**.
  - **Brevo (formerly Sendinblue):** Free tier allows **300 emails/day** with zero credit card required.
  - **Resend:** Free tier allows **100 emails/day** (3,000 emails/month).
  - **Ethereal Email:** Completely free virtual SMTP sandbox used automatically in development.
- **Environment Variables:**
  - `EMAIL_PROVIDER`: `smtp` | `brevo` | `resend` | `ethereal`
  - `SMTP_HOST`: e.g. `smtp-relay.brevo.com`
  - `SMTP_PORT`: e.g. `587`
  - `SMTP_USER`: SMTP login / API user
  - `SMTP_PASSWORD`: SMTP key / password
  - `MAIL_FROM`: Sender address (e.g. `Symbiosis HMS <noreply@your-domain.com>`)
  - `MAIL_FROM_NAME`: Display name
- **Where to Get Credential:**
  - Brevo: [https://www.brevo.com](https://www.brevo.com) -> SMTP & API Keys.
  - Resend: [https://resend.com](https://resend.com) -> API Keys.
- **Development Mode:** Automatic zero-config fallback to Ethereal. Preview URLs logged directly to console; no real mailbox needed.
- **Production Mode:** Brevo or Resend using a verified custom domain SPF/DKIM record.

---

### 3. File Storage (Uploads)
- **Purpose:** Storing weekly mess menus, student profile avatars, bus route schedules, and campus notice attachments.
- **Required?:** **No external service required**.
- **Free Option?:** **Yes**.
  - **Local Disk (Default):** Uploaded files are securely stored on disk in `backend/uploads/` with MIME/magic-byte validation, UUID file renaming, and path traversal protection.
  - **Cloud Object Storage (Optional for serverless/ephemeral platforms):** Cloudinary (free tier: 25 GB managed storage) or AWS S3 (free tier: 5 GB for 12 months).
- **Environment Variables:**
  - Standard mode: Zero external environment variables required.
  - Optional cloud mode: `CLOUDINARY_URL` or `AWS_S3_BUCKET`.
- **Development Mode:** Local disk storage in `backend/uploads/` served via Express static middleware.
- **Production Mode:** Docker persistent volume (`./backend/uploads:/app/uploads`) or Cloudinary free tier.

---

### 4. Cloud Application Hosting
- **Purpose:** Hosting the web frontend and Node.js backend.
- **Required?:** **Yes** for remote public deployment.
- **Free Option?:** **Yes**.
  - **Frontend:** **Cloudflare Pages** or **Vercel** / **Netlify** (Free static hosting, unlimited bandwidth, free automated SSL, edge CDN).
  - **Backend:** **Render** (Free Web Service tier: 750 free instance hours/month) or **Railway** / **Koyeb** free tiers.
- **Environment Variables:** `PORT`, `NODE_ENV`, `FRONTEND_URL`, `APP_BASE_URL`.
- **Where to Get:** [https://pages.cloudflare.com](https://pages.cloudflare.com) and [https://render.com](https://render.com).

---

### 5. Services Evaluated But Kept Zero-Cost / Not Mandatory

| Potential Service | Status | Rationale |
| :--- | :--- | :--- |
| **Sentry (Error Monitoring)** | *Not required for MVP* | Express centralized error handler and Docker stdout logs handle error tracking without paid licensing. |
| **Payment Provider (Razorpay/Stripe)** | *Not required for core MVP* | Booking fees and mess dues are recorded in MongoDB with admin invoice reconciliation. No payment gateway API keys needed unless online card processing is activated. |
| **Google Maps API** | *Not required* | Bus route schedules, stops, and timings are rendered using high-resolution schedule tables and responsive SVG route map layouts with zero Google Maps API quota usage. |
| **Twilio / SMS Gateway** | *Not required* | Notifications and room allocations are delivered via in-app persistent notification bells and email alerts. No expensive SMS API subscription needed. |

---

## 2. Secrets & Keys Summary

| Variable Name | Environment | Sample / Format | Required? |
| :--- | :--- | :--- | :--- |
| `MONGO_URI` | All | `mongodb+srv://user:pass@cluster.mongodb.net/hms` | **Yes** |
| `JWT_SECRET` | All | 64-char random string | **Yes** |
| `JWT_EXPIRE` | All | `30d` | Optional (default: 30d) |
| `REQUIRE_EMAIL_VERIFICATION` | Prod | `true` or `false` | Optional (default: false) |
| `EMAIL_PROVIDER` | Prod | `smtp` \| `brevo` \| `resend` \| `ethereal` | Optional (default: smtp) |
| `SMTP_HOST` | Prod | Hostname (e.g., `smtp-relay.brevo.com`) | Yes if EMAIL_PROVIDER=smtp |
| `SMTP_USER` | Prod | Username / API Login | Yes if EMAIL_PROVIDER=smtp |
| `SMTP_PASSWORD` | Prod | API Key / Password | Yes if EMAIL_PROVIDER=smtp |
