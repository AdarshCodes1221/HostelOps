require('dotenv').config();
const mongoose = require('mongoose');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  const MessMenu = require('./models/MessMenu');
  const BusRoute = require('./models/BusRoute');
  const Notice = require('./models/Notice');
  const User = require('./models/User');

  const adminUser = await User.findOne({ role: 'admin' });
  const adminId = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const meals = [
    { type: 'breakfast', items: ['Idli Sambar', 'Poha', 'Boiled Eggs', 'Tea/Coffee', 'Fresh Fruits'] },
    { type: 'lunch', items: ['Dal Makhani', 'Paneer Butter Masala', 'Jeera Rice', 'Roti', 'Salad & Curd'] },
    { type: 'snacks', items: ['Samosa / Veg Puff', 'Biscuits', 'Masala Tea', 'Cold Drink'] },
    { type: 'dinner', items: ['Mixed Veg Curry', 'Yellow Dal Tadka', 'Steamed Basmati Rice', 'Phulka', 'Gulab Jamun'] },
  ];

  for (const day of days) {
    for (const meal of meals) {
      await MessMenu.findOneAndUpdate(
        { day, mealType: meal.type },
        {
          day,
          mealType: meal.type,
          items: meal.items,
          lastUpdatedBy: adminId,
          weekStartDate: '2026-10-26'
        },
        { upsert: true, new: true }
      );
    }
  }

  // Ensure bus routes
  const existingRoutes = await BusRoute.countDocuments();
  if (existingRoutes < 3) {
    await BusRoute.create([
      {
        routeName: 'Route 2 - Hinjawadi IT Park Connector',
        stops: ['Hostel Complex', 'Lavale Village Circle', 'Wakad Bridge', 'Hinjawadi Phase 1'],
        timings: ['07:30 AM', '09:00 AM', '04:30 PM', '06:30 PM'],
        active: true
      },
      {
        routeName: 'Route 3 - Pune City Metro Link',
        stops: ['Hostel Gate', 'Pashan Circle', 'University Main Gate', 'Shivajinagar Metro Station'],
        timings: ['08:30 AM', '11:30 AM', '03:00 PM', '07:30 PM'],
        active: true
      }
    ]);
  }

  // Ensure hostel rules notice
  const rulesNotice = await Notice.findOne({ title: /Hostel Rules/i });
  if (!rulesNotice) {
    await Notice.create({
      title: 'Symbiosis Hostel Rules & Gate Regulations (2026)',
      description: '1. Biometric / QR outpass verification required for all gate movements.\n2. Curfew is strictly 10:00 PM on weekdays and 10:30 PM on weekends.\n3. Noise curfew from 11:00 PM to 06:00 AM.\n4. No unauthorized visitors in student residential wings after 08:00 PM.',
      imageUrl: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&q=80&w=1000',
      uploadedBy: adminId
    });
  }

  console.log('Seeded operational data successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
