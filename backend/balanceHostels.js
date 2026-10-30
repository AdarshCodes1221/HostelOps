const mongoose = require('mongoose');
const crypto = require('node:crypto');
require('dotenv').config();
const User = require('./models/User');
const Complaint = require('./models/Complaint');
const Outpass = require('./models/Outpass');
const Room = require('./models/Room');
const Hostel = require('./models/Hostel');

async function balance() {
  await mongoose.connect(process.env.MONGO_URI);
  const unassigned = await User.find({
    role: 'student',
    $or: [{ hostel: '' }, { hostel: null }, { hostel: 'unassigned' }]
  });
  console.log('Unassigned students:', unassigned.length);

  const orchid = await Hostel.findOne({ name: 'Orchid Hostel' });
  const magnolia = await Hostel.findOne({ name: 'Magnolia Hostel' });
  const orchidRooms = await Room.find({ hostel: orchid._id });
  const magnoliaRooms = await Room.find({ hostel: magnolia._id });

  let oIdx = 0, mIdx = 0;
  for (let i = 0; i < unassigned.length; i++) {
    const s = unassigned[i];
    if (i % 2 === 0) {
      const room = orchidRooms[oIdx % orchidRooms.length];
      s.hostel = 'Orchid Hostel';
      s.roomNumber = room.roomNumber;
      s.floor = String(room.floor);
      s.status = 'approved';
      await s.save();
      await Room.updateOne(
        { _id: room._id },
        { $addToSet: { occupants: s._id }, $set: { isOccupied: true, currentOccupancy: 1 } }
      );
      oIdx++;
    } else {
      const room = magnoliaRooms[mIdx % magnoliaRooms.length];
      s.hostel = 'Magnolia Hostel';
      s.roomNumber = room.roomNumber;
      s.floor = String(room.floor);
      s.status = 'approved';
      await s.save();
      await Room.updateOne(
        { _id: room._id },
        { $addToSet: { occupants: s._id }, $set: { isOccupied: true, currentOccupancy: 1 } }
      );
      mIdx++;
    }
  }

  // Ensure Voila 'voila' is 'Voila Hostel'
  await User.updateMany({ role: 'student', hostel: 'voila' }, { $set: { hostel: 'Voila Hostel' } });

  // Add sample complaint for Orchid if none
  const orchidStudents = await User.find({ role: 'student', hostel: 'Orchid Hostel' });
  const orchidComplaints = await Complaint.countDocuments({ hostel: 'Orchid Hostel' });
  if (orchidStudents.length > 0 && orchidComplaints === 0) {
    await Complaint.create({
      user: orchidStudents[0]._id,
      title: 'Water tap leaking in washroom',
      description: 'The washroom tap has been continuously dripping water since morning.',
      category: 'plumbing',
      hostel: 'Orchid Hostel',
      floor: orchidStudents[0].floor || '1',
      roomNumber: orchidStudents[0].roomNumber || '101',
      status: 'pending',
      assignedDepartment: 'maintenance'
    });
  }

  // Add sample complaint for Magnolia if none
  const magnoliaStudents = await User.find({ role: 'student', hostel: 'Magnolia Hostel' });
  const magnoliaComplaints = await Complaint.countDocuments({ hostel: 'Magnolia Hostel' });
  if (magnoliaStudents.length > 0 && magnoliaComplaints === 0) {
    await Complaint.create({
      user: magnoliaStudents[0]._id,
      title: 'Study room air conditioner not cooling',
      description: 'AC unit in study room is blowing warm air.',
      category: 'electrical',
      hostel: 'Magnolia Hostel',
      floor: magnoliaStudents[0].floor || '2',
      roomNumber: magnoliaStudents[0].roomNumber || '205',
      status: 'in_progress',
      assignedDepartment: 'electrical'
    });
  }

  // Outpasses for Orchid & Magnolia if none
  const orchidOutpasses = await Outpass.countDocuments({ hostel: 'Orchid Hostel' });
  if (orchidStudents.length > 0 && orchidOutpasses === 0) {
    await Outpass.create({
      student: orchidStudents[0]._id,
      hostel: 'Orchid Hostel',
      roomNumber: orchidStudents[0].roomNumber || '101',
      passCode: 'OP-' + crypto.randomInt(100000, 1000000),
      reason: 'Weekend Home Visit',
      category: 'home',
      destination: 'Mumbai',
      departureDate: new Date(),
      expectedReturnDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      parentContact: '9876543210',
      emergencyContact: '9876543210',
      wardenApproval: { status: 'pending' },
      adminApproval: { status: 'pending' },
      status: 'pending'
    });
  }

  const magnoliaOutpasses = await Outpass.countDocuments({ hostel: 'Magnolia Hostel' });
  if (magnoliaStudents.length > 0 && magnoliaOutpasses === 0) {
    await Outpass.create({
      student: magnoliaStudents[0]._id,
      hostel: 'Magnolia Hostel',
      roomNumber: magnoliaStudents[0].roomNumber || '205',
      passCode: 'OP-' + crypto.randomInt(100000, 1000000),
      reason: 'Academic Conference at SIU Lavale',
      category: 'academic',
      destination: 'Pune City',
      departureDate: new Date(),
      expectedReturnDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      parentContact: '9876543211',
      emergencyContact: '9876543211',
      wardenApproval: { status: 'approved', approvedAt: new Date() },
      adminApproval: { status: 'pending' },
      status: 'pending'
    });
  }

  // Verify all hostels
  const hostels = await Hostel.find({});
  for (const h of hostels) {
    const s = await User.countDocuments({ role: 'student', hostel: h.name });
    const c = await Complaint.countDocuments({ hostel: h.name });
    const o = await Outpass.countDocuments({ hostel: h.name });
    console.log(`Summary: ${h.name} -> Students: ${s}, Complaints: ${c}, Outpasses: ${o}`);
  }

  process.exit(0);
}

balance().catch(e => { console.error(e); process.exit(1); });
