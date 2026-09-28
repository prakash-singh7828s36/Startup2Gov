import { Router } from 'express';
import { signup, login, getMe, logout } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { USER_ROLES } from '../models/User.js';

const router = Router();

// Public auth routes (rate limited)
router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/logout', authenticateToken, logout);

// Authenticated session route
router.get('/me', authenticateToken, getMe);

// Role-protected test routes for Phase 1 verification
router.get(
  '/role-check/government',
  authenticateToken,
  requireRole(USER_ROLES.GOVERNMENT, USER_ROLES.ADMIN),
  (req, res) => {
    res.json({
      success: true,
      message: 'Access granted to government-only endpoint.',
      user: req.user.toPublicJSON(),
    });
  }
);

router.get(
  '/role-check/startup',
  authenticateToken,
  requireRole(USER_ROLES.STARTUP),
  (req, res) => {
    res.json({
      success: true,
      message: 'Access granted to startup-only endpoint.',
      user: req.user.toPublicJSON(),
    });
  }
);

export default router;
