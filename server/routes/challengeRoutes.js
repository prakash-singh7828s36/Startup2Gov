import { Router } from 'express';
import {
  listChallenges,
  getChallenge,
  getOwnedChallenges,
  createChallenge,
  updateChallenge,
  setChallengeStatus,
  deleteChallenge,
} from '../controllers/challengeController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import { USER_ROLES } from '../models/User.js';

const router = Router();

// Public / Startup browsable challenges (with optional auth to personalize match scores)
router.get('/', optionalAuth, listChallenges);

// Government-owned challenges (must be declared BEFORE /:id)
router.get(
  '/owned',
  authenticateToken,
  requireRole(USER_ROLES.GOVERNMENT, USER_ROLES.ADMIN),
  getOwnedChallenges
);

// Get single challenge by ID, customId, or slug
router.get('/:id', optionalAuth, getChallenge);

// Government create new challenge
router.post(
  '/',
  authenticateToken,
  requireRole(USER_ROLES.GOVERNMENT, USER_ROLES.ADMIN),
  createChallenge
);

// Government update existing challenge
router.put(
  '/:id',
  authenticateToken,
  requireRole(USER_ROLES.GOVERNMENT, USER_ROLES.ADMIN),
  updateChallenge
);

// Government change challenge status (Open, Closed, Draft)
router.patch(
  '/:id/status',
  authenticateToken,
  requireRole(USER_ROLES.GOVERNMENT, USER_ROLES.ADMIN),
  setChallengeStatus
);

// Government delete challenge
router.delete(
  '/:id',
  authenticateToken,
  requireRole(USER_ROLES.GOVERNMENT, USER_ROLES.ADMIN),
  deleteChallenge
);

export default router;
