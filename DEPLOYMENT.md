# Zero-Cost Production Deployment Guide

This guide details how to deploy the **Symbiosis Hostel Management System (Symbiosis HMS)** using verified **100% free-tier services**.

---

## 1. Architecture Overview (Zero-Cost Topology)

```
[Student / Admin Browser]
           │
           ├── HTTPS ──> [Cloudflare Pages / Vercel] ──> React SPA Frontend
           │
           └── HTTPS (REST / Cookie) ──> [Render / Railway Web Service] ──> Node.js Express API
                                                    │
                      ┌─────────────────────────────┼─────────────────────────────┐
                      ▼                             ▼                             ▼
             [MongoDB Atlas M0]              [Brevo / Resend]          [Persistent Disk Volume]
              Free 512 MB DB                 Free 300 emails/day        Uploads / Mess Menus
```

---

## 2. Component-by-Component Setup

### A. Database: MongoDB Atlas (M0 Free Tier)
1. Navigate to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and register a free account.
2. Click **Create Deployment** -> Select **M0 Free** (Shared, 512 MB storage).
3. Under **Security -> Database Access**, create a user with `Read and write to any database`.
4. Under **Network Access**, add `0.0.0.0/0` (Allow access from anywhere) so cloud hosts like Render can connect.
5. Copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/symbiosis_hms?retryWrites=true&w=majority
   ```

---

### B. Backend: Render Free Web Service
1. Create a free account at [render.com](https://render.com).
2. Connect your GitHub repository.
3. Click **New +** -> **Web Service**.
4. Configure service settings:
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm ci --only=production`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
5. Configure Environment Variables in Render:
   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `5000` |
   | `MONGO_URI` | *Your Atlas connection string* |
   | `JWT_SECRET` | *Strong 64-char random string* |
   | `JWT_EXPIRE` | `30d` |
   | `FRONTEND_URL` | `https://symbiosis-hms.pages.dev` (Your Cloudflare URL) |
   | `APP_BASE_URL` | `https://symbiosis-hms.pages.dev` |
   | `REQUIRE_EMAIL_VERIFICATION` | `true` |
   | `EMAIL_PROVIDER` | `smtp` |
   | `SMTP_HOST` | `smtp-relay.brevo.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | *Your Brevo SMTP login* |
   | `SMTP_PASSWORD` | *Your Brevo Master SMTP key* |
   | `MAIL_FROM` | `Symbiosis HMS <noreply@yourdomain.com>` |

---

### C. Frontend: Cloudflare Pages (Free Tier)
1. Sign up at [pages.cloudflare.com](https://pages.cloudflare.com).
2. Connect your GitHub repository.
3. Select project configuration:
   - **Framework preset:** `Vite`
   - **Root directory:** `hostel-compass`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Set Environment Variable:
   - `VITE_API_URL`: `https://your-backend.onrender.com/api`
5. Click **Save and Deploy**.
6. Cloudflare automatically provisions a free SSL certificate, global CDN edge distribution, and unlimited bandwidth.

---

### D. Transactional Email: Brevo (Free Tier)
1. Sign up at [brevo.com](https://www.brevo.com) (no credit card required).
2. Go to **Transactional** -> **Settings** -> **Configuration**.
3. Copy your SMTP Host (`smtp-relay.brevo.com`), Port (`587`), Login, and generate a new SMTP key.
4. Paste these values into your backend environment variables.
5. In development, if you do not set these variables, the application automatically falls back to **Ethereal Email** and outputs verification and password reset preview links directly in terminal logs.

---

## 3. Honest Free-Tier Limitations & Operational Realities

| Platform | Free-Tier Allowance | Operational Consideration / Limitation |
| :--- | :--- | :--- |
| **Render Web Service** | 750 free instance hours/month | **Cold Starts:** Instances spin down after 15 minutes of inactivity. The first request after idle takes 30–50 seconds to warm up. |
| **Cloudflare Pages** | Unlimited bandwidth, 500 builds/month | Completely static; client-side routing handled via `index.html`. |
| **MongoDB Atlas M0** | 512 MB storage, shared RAM | Max 500 concurrent connections. Sufficient for ~10,000 student documents; cannot run MongoDB Atlas search nodes. |
| **Brevo** | 300 emails / day | Daily reset at 00:00 UTC. Exceeding 300 emails in a day pauses email queue until next day. |
| **Resend** | 100 emails / day (3,000 / month) | Requires domain verification for custom sender names. |

> **Important Notice:** Free-tier quotas, bandwidth allocations, and idle policies are subject to change by respective cloud providers. Review provider dashboards periodically.
