import { Router } from 'express';
import { getMyProfile, updateMyProfile } from '../controllers/profileController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import { USER_ROLES } from '../models/User.js';

const router = Router();

// Startup profile routes: strictly scoped to current authenticated startup
router.get(
  '/me',
  authenticateToken,
  requireRole(USER_ROLES.STARTUP, USER_ROLES.ADMIN),
  getMyProfile
);

router.put(
  '/me',
  authenticateToken,
  requireRole(USER_ROLES.STARTUP, USER_ROLES.ADMIN),
  updateMyProfile
);

export default router;
