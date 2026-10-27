# MongoDB Setup Guide

## 🚨 Current Issue
Backend server cannot start because MongoDB is not running.

**Error:** `Could not connect to server. Please try again later.`

## ✅ Solution: Choose ONE Option Below

---

### Option 1: MongoDB Atlas (Cloud - Free & Easiest) ⭐ RECOMMENDED

1. **Create Free Account**
   - Go to: https://www.mongodb.com/cloud/atlas/register
   - Sign up with Google/GitHub or email

2. **Create Free Cluster**
   - Click "Build a Database"
   - Select "M0 Sandbox" (FREE forever)
   - Choose cloud provider (AWS recommended)
   - Choose region closest to you
   - Click "Create Cluster"

3. **Create Database User**
   - Click "Database Access" (left sidebar)
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Username: `hosteluser`
   - Password: Click "Autogenerate Secure Password" (copy it!)
   - User Privileges: "Atlas admin"
   - Click "Add User"

4. **Whitelist Your IP**
   - Click "Network Access" (left sidebar)
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Click "Confirm"

5. **Get Connection String**
   - Click "Database" (left sidebar)
   - Click "Connect" button on your cluster
   - Select "Connect your application"
   - Copy the connection string (looks like):
     ```
     mongodb+srv://hosteluser:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```

6. **Update Backend .env File**
   - Open: `backend/.env`
   - Replace `MONGO_URI` with your connection string
   - Replace `<password>` with your actual password
   - Example:
     ```env
     MONGO_URI=mongodb+srv://hosteluser:YourActualPassword123@cluster0.xxxxx.mongodb.net/hostelManagementSystem?retryWrites=true&w=majority
     ```

7. **Restart Backend**
   ```bash
   cd backend
   npm run dev
   ```

✅ **Done! Your app will connect to cloud MongoDB.**

---

### Option 2: Install MongoDB Locally (Windows)

1. **Download MongoDB**
   - Go to: https://www.mongodb.com/try/download/community
   - Select: Windows
   - Version: Latest (8.0+)
   - Click "Download"

2. **Install MongoDB**
   - Run the installer
   - Choose "Complete" installation
   - ✅ Check "Install MongoDB as a Service"
   - ✅ Check "Run service as Network Service user"
   - Click "Install"

3. **Start MongoDB Service**
   ```powershell
   # Open PowerShell as Administrator
   net start MongoDB
   ```

4. **Verify MongoDB is Running**
   ```powershell
   mongosh
   # You should see connection success
   ```

5. **Restart Backend**
   ```bash
   cd backend
   npm run dev
   ```

✅ **Done! Your app will connect to local MongoDB.**

---

## 🧪 Test Connection

After setup, test by visiting:
- Backend: http://localhost:5000
- You should see: `{"message":"Hostel Management System API"}`

Then try logging in to your app:
- Email: `test@student.siu.edu.in`
- Password: `student123`

---

## ❓ Still Having Issues?

1. **Check if backend is running:**
   ```bash
   cd backend
   npm run dev
   ```
   Look for: `✅ MongoDB Connected!`

2. **Check .env file:**
   - Make sure `MONGO_URI` is correctly set
   - No extra spaces or quotes

3. **Check firewall:**
   - Windows Firewall might block MongoDB
   - Allow MongoDB through firewall

---

## 📝 Current Configuration

**Backend .env file location:** `backend/.env`

**Current MONGO_URI:** `mongodb://localhost:27017/hostelManagementSystem`

This assumes MongoDB is running locally on port 27017.

If using Atlas, change to:
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/hostelManagementSystem
```
