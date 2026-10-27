const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const Room = require('./models/Room');
  const Hostel = require('./models/Hostel');

  // Set all rooms to capacity: 3, type: 'Triple'
  const updateResult = await Room.updateMany(
    {},
    {
      $set: {
        capacity: 3,
        type: 'Triple'
      }
    }
  );
  console.log(`Updated ${updateResult.modifiedCount} rooms to 3-seater capacity (Triple).`);

  // Ensure isOccupied and status match actual occupants
  const rooms = await Room.find({});
  for (const r of rooms) {
    const occCount = (r.occupants || []).length;
    r.isOccupied = occCount >= r.capacity;
    if (r.status !== 'MAINTENANCE') {
      r.status = r.isOccupied ? 'FULL' : 'AVAILABLE';
    }
    await r.save();
  }

  // Verify per hostel
  const hostels = await Hostel.find({});
  console.log('\n=============================================');
  console.log('HOSTEL CAPACITY AUDIT:');
  console.log('=============================================');
  let grandTotalRooms = 0;
  let grandTotalCapacity = 0;

  for (const h of hostels) {
    const hostelRooms = await Room.find({ hostel: h._id });
    const count = hostelRooms.length;
    const capacity = hostelRooms.reduce((acc, r) => acc + r.capacity, 0);
    grandTotalRooms += count;
    grandTotalCapacity += capacity;
    console.log(`• ${h.name}: ${count} rooms | Total Capacity: ${capacity} seats (${capacity / count} seats/room)`);
  }

  console.log('---------------------------------------------');
  console.log(`GRAND TOTAL: ${grandTotalRooms} rooms | ${grandTotalCapacity} total seats`);
  console.log('=============================================');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error updating room capacity:', err);
  process.exit(1);
});
