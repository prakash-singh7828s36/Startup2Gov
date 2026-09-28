import { Router } from 'express';
import { getDBStatus } from '../config/db.js';

const router = Router();

router.get('/health', (_req, res) => {
  const dbStatus = getDBStatus();
  const isHealthy = dbStatus.status === 'connected';

  const payload = {
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      status: dbStatus.status,
      name: dbStatus.database,
      host: dbStatus.host,
    },
    service: 'startup2gov-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };

  // Return 200 even if database is degraded, but status explicitly reflects database status
  return res.status(200).json(payload);
});

export default router;
