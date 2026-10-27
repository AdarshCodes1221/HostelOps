# MongoDB Quick Fix Guide

## Problem
Error: "Operation `users.findOne()` buffering timed out after 10000ms"

**Cause:** MongoDB is not running!

---

## Solution 1: Start MongoDB Service (Windows)

### Check if MongoDB is installed:
```powershell
mongod --version
```

### Start MongoDB Service:
```powershell
# Option A: As a Windows Service
net start MongoDB

# Option B: Run MongoDB manually
mongod --dbpath "C:\data\db"
```

### Common Issue: Data directory doesn't exist
```powershell
# Create the directory
mkdir C:\data\db

# Then start MongoDB
mongod --dbpath "C:\data\db"
```

---

## Solution 2: Use MongoDB Atlas (Cloud - FREE)

### Step 1: Create Free Account
1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Sign up for FREE tier
3. Create a cluster (M0 - FREE)

### Step 2: Get Connection String
1. In Atlas, click "Connect"
2. Choose "Connect your application"
3. Copy the connection string
4. It looks like: `mongodb+srv://username:password@cluster.mongodb.net/dbname`

### Step 3: Update Backend .env
```env
# Replace this line in backend/.env

```

### Step 4: Whitelist Your IP
1. In Atlas, go to "Network Access"
2. Click "Add IP Address"
3. Choose "Allow Access from Anywhere" (for development)
4. Click "Confirm"

---

## Solution 3: Use Docker (If you have Docker)

```powershell
# Start MongoDB in Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Stop MongoDB
docker stop mongodb

# Start again (after first run)
docker start mongodb
```

---

## How to Verify MongoDB is Running

### Test 1: Check if MongoDB is listening
```powershell
# Should see MongoDB on port 27017
netstat -an | findstr "27017"
```

### Test 2: Connect with MongoDB Shell
```powershell
mongosh
# or older version:
mongo
```

### Test 3: Check Backend Connection
```powershell
cd backend
npm run dev

# Should see: ✅ MongoDB Connected
# NOT: ❌ MongoDB Connection Error
```

---

## Quick Fix for Your Current Issue

**Step 1:** Open PowerShell as Administrator

**Step 2:** Try to start MongoDB service:
```powershell
net start MongoDB
```

**If that fails, run:**
```powershell
mongod --dbpath "C:\data\db"
```

**Step 3:** Keep that window open (MongoDB running)

**Step 4:** In NEW terminal, start your backend:
```powershell
cd backend
npm run dev
```

**Step 5:** Should now see:
```
✅ MongoDB Connected
Server running on port 5000
```

**Step 6:** Try login again - should work! ✅

---

## Alternative: Quick MongoDB Atlas Setup (5 minutes)

If local MongoDB is giving you trouble, use MongoDB Atlas (cloud):

1. **Sign up:** https://www.mongodb.com/cloud/atlas/register
2. **Create cluster:** Choose FREE M0 tier
3. **Create database user:** username + password
4. **Get connection string:** Click "Connect" → "Connect your application"
5. **Update .env:**
   ```env
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/hostelManagementSystem
   ```
6. **Whitelist IP:** Network Access → Add IP → Allow from anywhere
7. **Restart backend:** `npm run dev`

Done! Your app now uses cloud MongoDB (no local install needed).

---

## After MongoDB is Running

You should see in backend terminal:
```
✅ MongoDB Connected
Server running on port 5000
```

Then create admin user:
```powershell
cd backend
node seed.js
```

Or manually in MongoDB:
```javascript
// Connect to MongoDB
use hostelManagementSystem

```

Now try logging in again! 🎉

---

## Summary

**The error means:** Backend can't reach MongoDB
**Most common fix:** Start MongoDB service
**Easiest fix:** Use MongoDB Atlas (cloud, FREE)
**Your fix:** Choose solution 1, 2, or 3 above

After MongoDB is running, everything will work perfectly! ✅
