import mongoose from 'mongoose';
import Application, { APPLICATION_STATUS } from '../models/Application.js';

// Disable query buffering when disconnected to prevent 10s hangs
mongoose.set('bufferCommands', false);

let isConnected = false;

export async function ensureApplicationIndexes() {
  const duplicates = await Application.aggregate([
    { $match: { status: { $ne: APPLICATION_STATUS.WITHDRAWN } } },
    {
      $group: {
        _id: { user: '$user', challengeId: '$challengeId' },
        count: { $sum: 1 },
        applicationIds: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
    {
      $project: {
        _id: 0,
        user: '$_id.user',
        challengeId: '$_id.challengeId',
        count: 1,
        applicationIds: 1,
      },
    },
  ]);

  if (duplicates.length > 0) {
    const details = JSON.stringify(duplicates);
    console.error(`[MongoDB] Active duplicate applications prevent index creation: ${details}`);
    throw new Error(
      'Active duplicate applications must be reviewed and remediated before the unique application index can be created.'
    );
  }

  await Application.createIndexes();
  console.log('[MongoDB] Application indexes verified and created.');
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('[MongoDB] MONGODB_URI is not set in environment variables. Database functionality will be unavailable.');
    return false;
  }

  if (isConnected) {
    return true;
  }

  try {
    mongoose.connection.on('connected', () => {
      isConnected = true;
      console.log('[MongoDB] Connected successfully to database:', mongoose.connection.name);
    });

    mongoose.connection.on('error', (err) => {
      isConnected = false;
      console.error('[MongoDB] Connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('[MongoDB] Disconnected from database.');
    });

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (err) {
    isConnected = false;
    console.error('[MongoDB] Initial connection failure:', err.message);
    return false;
  }

  isConnected = true;
  try {
    await ensureApplicationIndexes();
  } catch (err) {
    isConnected = false;
    console.error('[MongoDB] Required application index initialization failed:', err.message);
    throw err;
  }
  return true;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      isConnected = false;
      console.log('[MongoDB] Disconnected cleanly.');
    } catch (err) {
      console.error('[MongoDB] Error during disconnect:', err.message);
    }
  }
}

export function getDBStatus() {
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const state = mongoose.connection.readyState;
  return {
    stateCode: state,
    status: stateMap[state] || 'unknown',
    database: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
  };
}

// Graceful process termination handlers
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});
