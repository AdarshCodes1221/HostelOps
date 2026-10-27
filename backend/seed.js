// seed.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { initializeHostelRooms } = require("./config/roomInitializer");

// Load env variables
dotenv.config();

// Import models
const User = require("./models/User");
const Hostel = require("./models/Hostel");
const Room = require("./models/Room");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected for Seeding"))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1);
  });

async function seed() {
  try {
    /* =========================
       SUPER ADMIN USER SETUP
    ========================== */
    const superAdminEmail = process.env.INITIAL_SUPER_ADMIN_EMAIL || "superadmin@siu.edu.in";
    const existingSuperAdmin = await User.findOne({ role: "super_admin" });

    if (!existingSuperAdmin) {
      // Use environment variable or generate a one-time secure password
      const superAdminPlainPassword = process.env.INITIAL_SUPER_ADMIN_PASSWORD || crypto.randomBytes(8).toString("hex") + "!S1";
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(superAdminPlainPassword, salt);

      await User.create({
        firstName: "Super",
        lastName: "System",
        email: superAdminEmail,
        password: hashedPassword,
        role: "super_admin",
        status: "approved",
        phone: "9999999999",
      });

      console.log("✅ Initial Super Admin user created safely:");
      console.log("   Email:", superAdminEmail);
      console.log("   Initial Password:", superAdminPlainPassword);
      console.log("   ⚠️ Please change this password immediately upon first login!");
    } else {
      console.log("ℹ Super Administrator account already exists. No default accounts overwritten.");
    }

    /* =========================
       ADMIN USER SETUP
    ========================== */
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || "admin@siu.edu.in";
    const existingAdmin = await User.findOne({ role: "admin" });

    if (!existingAdmin) {
      // Use environment variable or generate a one-time secure password
      const adminPlainPassword = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(8).toString("hex") + "!A1";
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(adminPlainPassword, salt);

      await User.create({
        firstName: "System",
        lastName: "Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        status: "approved",
        phone: "9999999999",
      });

      console.log("✅ Initial Admin user created safely:");
      console.log("   Email:", adminEmail);
      console.log("   Initial Password:", adminPlainPassword);
      console.log("   ⚠️ Please change this password immediately upon first login!");
    } else {
      console.log("ℹ Administrator account already exists. No default accounts overwritten.");
    }

    /* =========================
       HOSTELS & ROOMS
    ========================== */
    await initializeHostelRooms();

    /* =========================
       WARDEN USER SETUP AND ASSIGNMENT
    ========================== */
    // Get all hostels
    const hostels = await Hostel.find({});
    for (const hostel of hostels) {
      // Check if a warden already exists for this hostel
      const existingWardenForHostel = await User.findOne({ role: "warden", hostel: hostel.name });
      if (!existingWardenForHostel) {
        // Create a warden user for this hostel
        const wardenEmail = `warden.${hostel.name.toLowerCase().replace(/\s+/g, '.')}@siu.edu.in`;
        const wardenPlainPassword = process.env.INITIAL_WARDEN_PASSWORD || crypto.randomBytes(8).toString("hex") + "!W1";
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(wardenPlainPassword, salt);

        const warden = await User.create({
          firstName: hostel.name,
          lastName: "Warden",
          email: wardenEmail,
          password: hashedPassword,
          role: "warden",
          status: "approved",
          phone: "9999999999",
          hostel: hostel.name, // Assign hostel to the warden user (for convenience, though we also assign via Hostel.warden)
        });

        // Assign the warden to the hostel
        hostel.warden = warden._id;
        await hostel.save();

        console.log(`✅ Created and assigned warden for ${hostel.name}:`);
        console.log(`   Email: ${wardenEmail}`);
        console.log(`   Initial Password: ${wardenPlainPassword}`);
        console.log(`   ⚠️ Please change this password immediately upon first login!`);
      }
    }

    console.log("✅ Seeding completed safely");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

seed();
