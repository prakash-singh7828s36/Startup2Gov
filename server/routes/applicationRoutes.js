import { Router } from 'express';
import {
  getDraft,
  saveDraft,
  clearDraft,
  submitApplication,
  getMyApplications,
  getApplicationById,
  withdrawApplication,
  getGovInbox,
  reviewApplication,
} from '../controllers/applicationController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import { USER_ROLES } from '../models/User.js';

const router = Router();

// Draft routes (must precede /:id)
router.get(
  '/drafts/:challengeId',
  authenticateToken,
  requireRole(USER_ROLES.STARTUP, USER_ROLES.ADMIN),
  getDraft
);

router.post(
  '/drafts/:challengeId',
  authenticateToken,
  requireRole(USER_ROLES.STARTUP, USER_ROLES.ADMIN),
  saveDraft
);

router.delete(
  '/drafts/:challengeId',
  authenticateToken,
  requireRole(USER_ROLES.STARTUP, USER_ROLES.ADMIN),
  clearDraft
);

// Startup applications list
router.get(
  '/my',
  authenticateToken,
  requireRole(USER_ROLES.STARTUP, USER_ROLES.ADMIN),
  getMyApplications
);

// Government inbox list
router.get(
  '/gov/inbox',
  authenticateToken,
  requireRole(USER_ROLES.GOVERNMENT, USER_ROLES.ADMIN),
  getGovInbox
);

// Submit new application
router.post(
  '/',
  authenticateToken,
  requireRole(USER_ROLES.STARTUP, USER_ROLES.ADMIN),
  submitApplication
);

// Review application (Government review)
router.patch(
  '/:id/review',
  authenticateToken,
  requireRole(USER_ROLES.GOVERNMENT, USER_ROLES.ADMIN),
  reviewApplication
);

// Withdraw application (Startup)
router.delete(
  '/:id',
  authenticateToken,
  requireRole(USER_ROLES.STARTUP, USER_ROLES.ADMIN),
  withdrawApplication
);

router.post(
  '/:id/withdraw',
  authenticateToken,
  requireRole(USER_ROLES.STARTUP, USER_ROLES.ADMIN),
  withdrawApplication
);

// Get single application by ID or applicationNumber (enforces authorization)
router.get(
  '/:id',
  authenticateToken,
  getApplicationById
);

export default router;
