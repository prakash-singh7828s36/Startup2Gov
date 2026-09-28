import dotenv from 'dotenv';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { assertJwtConfiguration } from './utils/jwt.js';

// Load environment variables from .env file if available
dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  console.log('='.repeat(50));
  console.log(`[Startup2Gov] Initializing backend in ${process.env.NODE_ENV || 'development'} mode...`);
  console.log('='.repeat(50));

  assertJwtConfiguration();

  // Connect to database
  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.warn('[Startup2Gov] Running in degraded mode: MongoDB Atlas is not connected.');
    console.warn('[Startup2Gov] Provide a valid MONGODB_URI in server/.env to enable database operations.');
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Startup2Gov API] Server listening on port ${PORT}`);
    console.log(`[Startup2Gov API] Health check available at http://localhost:${PORT}/api/health`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error('[Startup2Gov] Unhandled Promise Rejection:', err);
    // Keep server running in dev, or close gracefully
  });

  process.on('uncaughtException', (err) => {
    console.error('[Startup2Gov] Uncaught Exception:', err);
  });

  return server;
}

startServer().catch(async (err) => {
  console.error('[Startup2Gov] Server startup aborted:', err.message);
  await disconnectDB();
  process.exitCode = 1;
});
