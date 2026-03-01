import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const VOLUNTEER_NAMES = [
  'Alex Rivera', 'Jordan Chen', 'Sam Patel', 'Morgan Williams', 'Casey Thompson',
  'Taylor Anderson', 'Riley Martinez', 'Drew Jackson', 'Avery White', 'Blake Harris',
  'Quinn Robinson', 'Reese Clark', 'Finley Lewis', 'Jamie Lee', 'Skyler Walker',
  'Dakota Hall', 'Peyton Young', 'Hayden King', 'Emery Wright', 'Rowan Scott',
];

// Skills using the updated 10-item list
const SKILL_SETS = [
  // Power users — many skills (indices 0-4)
  ['First Aid', 'CPR Certified', 'Search & Rescue', 'Leadership/Coordination'],
  ['First Aid', 'Firefighting', 'Hazmat Handling', 'Search & Rescue'],
  ['CPR Certified', 'Elderly/Disability Care', 'First Aid', 'Multilingual'],
  ['Search & Rescue', 'Leadership/Coordination', 'Animal Rescue', 'First Aid'],
  ['Firefighting', 'Hazmat Handling', 'First Aid', 'CPR Certified'],
  // Mixed — 2-3 skills (indices 5-14)
  ['First Aid', 'General Labor'],
  ['Search & Rescue', 'General Labor'],
  ['Leadership/Coordination', 'Multilingual'],
  ['CPR Certified', 'Elderly/Disability Care'],
  ['Animal Rescue', 'General Labor'],
  ['First Aid', 'General Labor'],
  ['Firefighting', 'General Labor'],
  ['Multilingual', 'Leadership/Coordination'],
  ['Search & Rescue', 'First Aid'],
  ['General Labor', 'CPR Certified'],
  // Basic helpers — general labor only (indices 15-17)
  ['General Labor'],
  ['General Labor'],
  ['General Labor'],
  // Off-duty volunteers (indices 18-19)
  ['First Aid', 'Search & Rescue'],
  ['General Labor', 'Leadership/Coordination'],
];

// Resources using the updated 10-item list
const RESOURCE_SETS = [
  // Power users — many resources (indices 0-4)
  ['Boat/Kayak', 'Water Pump', 'Generator', 'First Aid Kit'],
  ['Generator', 'Power Tools', 'Chainsaw'],
  ['First Aid Kit', 'SUV/4WD Vehicle', 'Generator'],
  ['Pickup Truck', 'Chainsaw', 'Power Tools'],
  ['Boat/Kayak', 'Sandbags', 'Water Pump'],
  // Mixed — 0-2 resources (indices 5-14)
  ['First Aid Kit'],
  ['SUV/4WD Vehicle'],
  ['Generator'],
  ['First Aid Kit'],
  ['Pickup Truck'],
  ['Sandbags'],
  ['Chainsaw'],
  [],
  ['Water Pump'],
  ['Snow Plow'],
  // Basic helpers — no resources (indices 15-17)
  [],
  [],
  [],
  // Off-duty volunteers (indices 18-19)
  ['First Aid Kit', 'SUV/4WD Vehicle'],
  [],
];

// Last 2 volunteers are off-duty to test availability filtering
const AVAILABILITY = [
  true, true, true, true, true,
  true, true, true, true, true,
  true, true, true, true, true,
  true, true, true,
  false, false,
];

// 20 volunteers distributed across NYC clusters
const VOLUNTEER_COORDS = [
  // Manhattan downtown cluster (5 volunteers)
  { latitude: 40.7110, longitude: -74.0030 },
  { latitude: 40.7152, longitude: -73.9995 },
  { latitude: 40.7128, longitude: -74.0060 },
  { latitude: 40.7200, longitude: -73.9970 },
  { latitude: 40.7185, longitude: -74.0010 },
  // Manhattan midtown cluster (5 volunteers)
  { latitude: 40.7480, longitude: -73.9900 },
  { latitude: 40.7549, longitude: -73.9840 },
  { latitude: 40.7560, longitude: -73.9760 },
  { latitude: 40.7510, longitude: -73.9830 },
  { latitude: 40.7590, longitude: -73.9780 },
  // Upper Manhattan cluster (3 volunteers)
  { latitude: 40.7775, longitude: -73.9820 },
  { latitude: 40.7831, longitude: -73.9712 },
  { latitude: 40.7890, longitude: -73.9650 },
  // Brooklyn cluster (4 volunteers)
  { latitude: 40.6380, longitude: -73.9650 },
  { latitude: 40.6500, longitude: -73.9490 },
  { latitude: 40.6550, longitude: -73.9350 },
  { latitude: 40.6640, longitude: -73.9310 },
  // Queens cluster (3 volunteers)
  { latitude: 40.7210, longitude: -73.8550 },
  { latitude: 40.7350, longitude: -73.8200 },
  { latitude: 40.7440, longitude: -73.8060 },
];

async function main() {
  console.log('Starting database seed...\n');

  // Clean existing data in dependency order
  console.log('Cleaning existing data...');
  await prisma.sensorReading.deleteMany();
  await prisma.deployment.deleteMany();
  await prisma.surgeEvent.deleteMany();
  await prisma.volunteer.deleteMany();
  await prisma.user.deleteMany();
  console.log('Cleaned\n');

  // Create admin user
  console.log('Creating admin user...');
  const adminPassword = await bcrypt.hash('admin123', 12);
  await prisma.user.create({
    data: {
      email: 'admin@civicsurge.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });
  console.log('  admin@civicsurge.com / admin123\n');

  // Create 20 volunteers
  console.log('Creating volunteers...');
  const volunteerPassword = await bcrypt.hash('volunteer123', 12);

  for (let i = 0; i < VOLUNTEER_NAMES.length; i++) {
    const name = VOLUNTEER_NAMES[i];
    const skills = SKILL_SETS[i];
    const resources = RESOURCE_SETS[i];
    const coords = VOLUNTEER_COORDS[i];
    const isAvailable = AVAILABILITY[i];
    const email = `${name.toLowerCase().replace(' ', '.')}@volunteer.civicsurge.com`;
    const phone = `+1555${String(i + 1).padStart(7, '0')}`;

    const user = await prisma.user.create({
      data: {
        email,
        password: volunteerPassword,
        name,
        role: 'VOLUNTEER',
      },
    });

    await prisma.volunteer.create({
      data: {
        userId: user.id,
        phone,
        latitude: coords.latitude,
        longitude: coords.longitude,
        skills,
        resources,
        isAvailable,
      },
    });

    const badge = isAvailable ? '🟢' : '🔴';
    const resourceStr = resources.length > 0 ? ` | ${resources.join(', ')}` : '';
    console.log(`  ${badge} ${name} — ${skills.join(', ')}${resourceStr}`);
  }

  console.log('\nSeed complete!\n');
  console.log('════════════════════════════════════════════');
  console.log('  Admin:              admin@civicsurge.com / admin123');
  console.log('  Volunteers:         *.volunteer.civicsurge.com / volunteer123');
  console.log('  First volunteer:    alex.rivera@volunteer.civicsurge.com');
  console.log('════════════════════════════════════════════');
  console.log('  Volunteers created: 18 available, 2 off-duty');
  console.log('  Profile tiers:      5 power users | 10 mixed | 3 basic | 2 off-duty');
  console.log('  Clusters:           Downtown (5) | Midtown (5) | Upper Manhattan (3) | Brooklyn (4) | Queens (3)');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
