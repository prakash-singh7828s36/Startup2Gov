import dotenv from 'dotenv';
import User, { USER_ROLES } from '../models/User.js';
import { connectDB, disconnectDB } from '../config/db.js';

dotenv.config();

const DEMO_USERS = [
  {
    name: 'Smart Waste AI',
    startupName: 'Smart Waste AI',
    email: 'demo@startup.in',
    password: 'password123',
    role: USER_ROLES.STARTUP,
  },
  {
    name: 'Urban Development Department',
    orgName: 'Urban Development Department',
    department: 'Urban Development Department',
    designation: 'Nodal Officer',
    email: 'demo@gov.in',
    password: 'password123',
    role: USER_ROLES.GOVERNMENT,
  },
];

async function seed() {
  if (
    String(process.env.NODE_ENV).toLowerCase() === 'production' ||
    process.env.SEED_DEMO_USERS !== 'true'
  ) {
    console.error('[Seed] Demo users require SEED_DEMO_USERS=true and are disabled in production.');
    process.exitCode = 1;
    return;
  }

  console.log('[Seed] Connecting to MongoDB...');
  const connected = await connectDB();
  if (!connected) {
    console.error('[Seed] Could not connect to database. Ensure MONGODB_URI is set.');
    process.exit(1);
  }

  try {
    for (const demoUser of DEMO_USERS) {
      const exists = await User.findOne({ email: demoUser.email });
      if (exists) {
        console.log(`[Seed] User ${demoUser.email} (${demoUser.role}) already exists. Skipping.`);
      } else {
        await User.create(demoUser);
        console.log(`[Seed] Created demo user: ${demoUser.email} (${demoUser.role})`);
      }
    }
    console.log('[Seed] Seeding completed successfully.');
  } catch (err) {
    console.error('[Seed] Error during seeding:', err.message);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

seed();
