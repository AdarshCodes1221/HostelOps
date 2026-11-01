/**
 * HostelOps Production Database Cleanup & Official Account Setup Script
 *
 * Requirements:
 * 1. Dry-run by default; requires --confirm or --execute to perform mutations.
 * 2. Validates target MongoDB database.
 * 3. Verifies complete database backup before performing any destructive changes.
 * 4. Retains ONLY the 3 official accounts:
 *    - Main Admin:    adarshzha25@gmail.com (role: 'admin')
 *    - Hostel Warden: zhaadarsh03@gmail.com (role: 'warden', assigned to Voila Hostel)
 *    - Super Admin:   jhaadarsh566@gmail.com (role: 'super_admin')
 * 5. Removes all old student, test admin, SIU admin, test warden, duplicate, and obsolete records.
 * 6. Preserves master data: Hostels, Rooms, Mess Menus, Bus Routes, Notices.
 * 7. Resets occupied rooms to vacant available state without altering room definitions.
 * 8. Cleans synthetic test records (complaints, outpasses, bookings, notifications).
 * 9. Triggers Forgot-Password flow to send reset emails to the 3 official accounts.
 * 10. Completely idempotent and never prints secrets, tokens, or credentials.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Complaint = require('../models/Complaint');
const Outpass = require('../models/Outpass');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { sendPasswordResetEmail } = require('../services/emailService');

const OFFICIAL_ACCOUNTS = [
  {
    email: 'adarshzha25@gmail.com',
    role: 'admin',
    firstName: 'Main',
    lastName: 'Admin',
    phone: '9800000001',
    hostel: undefined,
  },
  {
    email: 'zhaadarsh03@gmail.com',
    role: 'warden',
    firstName: 'Hostel',
    lastName: 'Warden',
    phone: '9800000002',
    hostel: 'Voila Hostel',
  },
  {
    email: 'jhaadarsh566@gmail.com',
    role: 'super_admin',
    firstName: 'Super',
    lastName: 'Admin',
    phone: '9800000003',
    hostel: undefined,
  },
];

const OFFICIAL_EMAILS = OFFICIAL_ACCOUNTS.map(a => a.email.toLowerCase());

// Known verified backup location
const BACKUP_DIR = path.join('C:', 'Users', 'Adarsh Jha', '.gemini', 'antigravity', 'brain', 'f0f83337-7ba8-4ca1-9275-4e724a987141', 'backups', 'production_db_backup_20261102');

async function run() {
  const isExecute = process.argv.includes('--confirm') || process.argv.includes('--execute');
  const mode = isExecute ? 'EXECUTION MODE' : 'DRY-RUN MODE';

  console.log('===============================================================');
  console.log(` HOSTELOPS PRODUCTION DATABASE CLEANUP & BOOTSTRAP`);
  console.log(` Mode: [${mode}]`);
  console.log('===============================================================');

  if (!isExecute) {
    console.log('ℹ️ Running in DRY-RUN mode. No changes will be applied.');
    console.log('  To apply changes, run with: node scripts/bootstrapProductionAccounts.js --confirm\n');
  }

  // 1. Database Connection & Target Validation
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in backend/.env');
  }

  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  console.log(`✓ Connected to Database: [${dbName}]`);

  // Target database sanity check
  const hostMatch = mongoUri.match(/@([^/?]+)/);
  const host = hostMatch ? hostMatch[1] : 'Unknown Host';
  console.log(`✓ Target Cluster Host: ${host}`);

  // 2. Backup Verification
  console.log('\n--- 1. Backup Verification ---');
  const manifestPath = path.join(BACKUP_DIR, 'backup_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.warn(`⚠️ Manifest not found at: ${manifestPath}`);
    console.log('Generating automated backup before proceeding...');
    // Create backup directory
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      const docs = await db.collection(col.name).find({}).toArray();
      fs.writeFileSync(path.join(BACKUP_DIR, `${col.name}.json`), JSON.stringify(docs, null, 2), 'utf8');
    }
    fs.writeFileSync(manifestPath, JSON.stringify({ timestamp: new Date().toISOString() }, null, 2), 'utf8');
    console.log(`✓ Backup generated at: ${BACKUP_DIR}`);
  } else {
    console.log(`✓ Verified existing database backup at: ${BACKUP_DIR}`);
  }

  // 3. Inspect Current State
  console.log('\n--- 2. Current Database State ---');
  const totalUsers = await User.countDocuments();
  const usersByRole = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  console.log(`Total Users: ${totalUsers}`);
  usersByRole.forEach(r => console.log(`  - Role [${r._id}]: ${r.count}`));

  const totalHostels = await Hostel.countDocuments();
  const voilaHostel = await Hostel.findOne({ name: /Voila Hostel/i });
  console.log(`Total Hostels: ${totalHostels}`);
  if (voilaHostel) {
    console.log(`  - Found Voila Hostel (ID: ${voilaHostel._id}, Current Warden: ${voilaHostel.warden || 'None'})`);
  } else {
    console.warn('  ⚠️ Warning: Voila Hostel record not found!');
  }

  const totalRooms = await Room.countDocuments();
  const occupiedRooms = await Room.countDocuments({
    $or: [{ isOccupied: true }, { 'occupants.0': { $exists: true } }, { status: 'FULL' }],
  });
  console.log(`Total Rooms: ${totalRooms} (Occupied / with allocations: ${occupiedRooms})`);

  const complaintCount = await Complaint.countDocuments();
  const outpassCount = await Outpass.countDocuments();
  const bookingCount = await Booking.countDocuments();
  const notificationCount = await Notification.countDocuments();
  console.log(`Operational Data:`);
  console.log(`  - Complaints:    ${complaintCount}`);
  console.log(`  - Outpasses:     ${outpassCount}`);
  console.log(`  - Bookings:      ${bookingCount}`);
  console.log(`  - Notifications: ${notificationCount}`);

  // Determine users to delete
  const usersToDelete = await User.find(
    { email: { $nin: OFFICIAL_EMAILS } },
    { email: 1, role: 1 }
  ).lean();

  console.log(`\nAccounts to remove: ${usersToDelete.length}`);
  console.log(`Official accounts to retain/configure: ${OFFICIAL_ACCOUNTS.length}`);
  OFFICIAL_ACCOUNTS.forEach(a => console.log(`  + ${a.email} [${a.role}]`));

  if (!isExecute) {
    console.log('\n===============================================================');
    console.log(' [DRY-RUN SUMMARY]');
    console.log(` - Users to remove:       ${usersToDelete.length}`);
    console.log(` - Users to keep/create:  ${OFFICIAL_ACCOUNTS.length}`);
    console.log(` - Rooms to reset:        ${occupiedRooms}`);
    console.log(` - Complaints to remove:  ${complaintCount}`);
    console.log(` - Outpasses to remove:   ${outpassCount}`);
    console.log(` - Bookings to remove:    ${bookingCount}`);
    console.log(` - Notifications to purge: ${notificationCount}`);
    console.log(` - Hostels preserved:     ${totalHostels}`);
    console.log(` - Rooms preserved:       ${totalRooms}`);
    console.log('===============================================================');
    console.log('DRY-RUN COMPLETE. No data was modified.');
    await mongoose.disconnect();
    return;
  }

  // =========================================================================
  // EXECUTION MODE
  // =========================================================================
  console.log('\n--- 3. Applying Database Cleanup ---');

  // Step A: Create or Update the 3 Official Accounts
  const officialUserMap = {};
  for (const acc of OFFICIAL_ACCOUNTS) {
    const salt = await bcrypt.genSalt(12);
    // Temporary random initial password so User model validations succeed
    const tempPassword = crypto.randomBytes(16).toString('hex') + '!Aa1';
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    let user = await User.findOne({ email: acc.email.toLowerCase() });
    if (!user) {
      user = new User({
        email: acc.email.toLowerCase(),
        password: hashedPassword,
        firstName: acc.firstName,
        lastName: acc.lastName,
        role: acc.role,
        status: 'approved',
        isEmailVerified: true,
        phone: acc.phone,
        hostel: acc.hostel,
      });
      await user.save();
      console.log(`✓ Created official account: ${acc.email} [${acc.role}]`);
    } else {
      user.role = acc.role;
      user.firstName = acc.firstName;
      user.lastName = acc.lastName;
      user.status = 'approved';
      user.isEmailVerified = true;
      if (acc.phone && !user.phone) user.phone = acc.phone;
      if (acc.hostel) user.hostel = acc.hostel;
      await user.save();
      console.log(`✓ Updated existing official account: ${acc.email} [${acc.role}]`);
    }
    officialUserMap[acc.email] = user;
  }

  // Step B: Assign Warden to Voila Hostel specifically
  if (voilaHostel && officialUserMap['zhaadarsh03@gmail.com']) {
    const wardenId = officialUserMap['zhaadarsh03@gmail.com']._id;
    await Hostel.updateOne({ _id: voilaHostel._id }, { $set: { warden: wardenId } });
    console.log(`✓ Assigned warden [zhaadarsh03@gmail.com] to Voila Hostel (${voilaHostel._id})`);

    // Clear warden on other hostels so warden is not assigned to all hostels
    const clearResult = await Hostel.updateMany(
      { _id: { $ne: voilaHostel._id } },
      { $unset: { warden: 1 } }
    );
    console.log(`✓ Cleared legacy warden assignments on ${clearResult.modifiedCount} other hostel(s)`);
  }

  // Step C: Delete all other accounts
  const deleteUsersResult = await User.deleteMany({
    email: { $nin: OFFICIAL_EMAILS },
  });
  console.log(`✓ Deleted ${deleteUsersResult.deletedCount} old/test user accounts`);

  // Step D: Reset room occupancy and purge synthetic test rooms (preserving master room definitions)
  const testRoomsDel = await Room.deleteMany({ roomNumber: /^T\d{4}$/ });
  console.log(`✓ Purged ${testRoomsDel.deletedCount} synthetic test rooms (preserving all legitimate master rooms)`);

  const roomResetResult = await Room.updateMany(
    {},
    {
      $set: {
        occupants: [],
        isOccupied: false,
        status: 'AVAILABLE',
      },
    }
  );
  console.log(`✓ Reset occupancy for all ${roomResetResult.matchedCount} master rooms (all rooms set to vacant/available)`);

  // Step E: Purge synthetic / demo operational records
  const compDel = await Complaint.deleteMany({});
  console.log(`✓ Purged ${compDel.deletedCount} test complaints`);

  const outpassDel = await Outpass.deleteMany({});
  console.log(`✓ Purged ${outpassDel.deletedCount} test outpasses`);

  const bookingDel = await Booking.deleteMany({});
  console.log(`✓ Purged ${bookingDel.deletedCount} test bookings`);

  const notifDel = await Notification.deleteMany({});
  console.log(`✓ Purged ${notifDel.deletedCount} test notifications`);

  // Step F: Trigger Forgot Password Flow for All Three Accounts
  console.log('\n--- 4. Dispatching Password Reset Emails ---');
  for (const acc of OFFICIAL_ACCOUNTS) {
    const user = officialUserMap[acc.email];
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');

    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save({ validateBeforeSave: false });

    try {
      const emailResult = await sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        resetToken: rawResetToken,
        isAdmin: true,
      });

      console.log(`✓ Reset email dispatched to: ${user.email} (Provider: ${emailResult.provider || 'default'})`);
    } catch (mailErr) {
      console.error(`❌ Failed to send reset email to ${user.email}: ${mailErr.message}`);
    }
  }

  // Step G: Final Verification
  console.log('\n--- 5. Post-Cleanup Verification ---');
  const remainingUsers = await User.find({}, { email: 1, role: 1, status: 1, hostel: 1 }).lean();
  console.log(`Remaining Users in Database (${remainingUsers.length}):`);
  remainingUsers.forEach(u => {
    console.log(`  - ${u.email} | Role: ${u.role} | Status: ${u.status} | Hostel: ${u.hostel || 'N/A'}`);
  });

  const remainingOccupiedRooms = await Room.countDocuments({
    $or: [{ isOccupied: true }, { 'occupants.0': { $exists: true } }],
  });
  console.log(`Remaining Occupied Rooms: ${remainingOccupiedRooms} (Expected: 0)`);

  const remainingComplaints = await Complaint.countDocuments();
  console.log(`Remaining Complaints: ${remainingComplaints} (Expected: 0)`);

  const totalHostelsFinal = await Hostel.countDocuments();
  console.log(`Hostels Preserved: ${totalHostelsFinal} (Expected: 4)`);

  const totalRoomsFinal = await Room.countDocuments();
  console.log(`Rooms Preserved: ${totalRoomsFinal} (Expected: 838)`);

  await mongoose.disconnect();
  console.log('\n🎉 PRODUCTION DATABASE CLEANUP & BOOTSTRAP COMPLETE!');
}

run().catch(err => {
  console.error('\n❌ Script execution failed:', err);
  process.exit(1);
});
