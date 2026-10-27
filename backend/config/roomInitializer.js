const Hostel = require('../models/Hostel');
const Room = require('../models/Room');

const DEFAULT_HOSTELS = [
  {
    name: 'Voila Hostel',
    description: 'Modern hostel with excellent facilities',
    address: '123 North Campus Road',
    city: 'Pune',
    state: 'Maharashtra',
    zipCode: '411001',
    phone: '020-12345678',
    email: 'voila@sitpune.edu.in',
    location: 'North Campus',
    floors: 5,
    totalRooms: 240,
  },
  {
    name: 'Magnolia Hostel',
    description: 'Peaceful and comfortable hostel',
    address: '456 South Campus Avenue',
    city: 'Pune',
    state: 'Maharashtra',
    zipCode: '411002',
    phone: '020-23456789',
    email: 'magnolia@sitpune.edu.in',
    location: 'South Campus',
    floors: 4,
    totalRooms: 260,
  },
  {
    name: 'Orchid Hostel',
    description: 'Premium hostel with modern amenities',
    address: '789 East Campus Boulevard',
    city: 'Pune',
    state: 'Maharashtra',
    zipCode: '411003',
    phone: '020-34567890',
    email: 'orchid@sitpune.edu.in',
    location: 'East Campus',
    floors: 6,
    totalRooms: parseInt(process.env.ORCHID_ROOM_COUNT, 10) || 200,
  },
];

function buildRoomPayload(startNumber, endNumber, hostelId) {
  const rooms = [];
  for (let i = startNumber; i <= endNumber; i += 1) {
    const floor = Math.floor((i - 1) / 24);
    const numberWithinFloor = ((i - 1) % 24) + 1;
    const roomNumber = `${floor}${numberWithinFloor.toString().padStart(2, '0')}`;
    rooms.push({
      hostel: hostelId,
      roomNumber,
      floor,
      capacity: 3,
      occupants: [],
      isOccupied: false,
    });
  }
  return rooms;
}

async function ensureRoomsForHostel(hostel, desiredTotal) {
  await Room.updateMany({ hostel: hostel._id }, { $set: { capacity: 3 } });
  await Room.updateMany({ hostel: hostel._id, occupants: { $exists: false } }, { $set: { occupants: [] } });

  const existingCount = await Room.countDocuments({ hostel: hostel._id });
  if (existingCount >= desiredTotal) return;

  const roomsToInsert = buildRoomPayload(existingCount + 1, desiredTotal, hostel._id);
  if (roomsToInsert.length) {
    await Room.insertMany(roomsToInsert);
    console.log(`✅ Added ${roomsToInsert.length} rooms for ${hostel.name}`);
  }
}

async function ensureHostelsExist() {
  for (const config of DEFAULT_HOSTELS) {
    let hostel = await Hostel.findOne({ name: config.name });
    if (!hostel) {
      hostel = await Hostel.create(config);
      console.log(`✅ Created hostel: ${config.name}`);
    }
    await ensureRoomsForHostel(hostel, config.totalRooms);
  }
}

async function initializeHostelRooms() {
  try {
    await ensureHostelsExist();
  } catch (err) {
    console.error('❌ Failed to initialize hostel rooms:', err.message);
    throw err;
  }
}

module.exports = { initializeHostelRooms };
