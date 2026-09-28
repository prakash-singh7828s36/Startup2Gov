import { Router } from 'express';
import {
  documentUploadMiddleware,
  uploadDocument,
  downloadDocument,
} from '../controllers/documentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Upload document (authenticated startup or government officer)
router.post(
  '/upload',
  authenticateToken,
  documentUploadMiddleware,
  uploadDocument
);

// Secure private download route (enforces access control)
router.get(
  '/:storageKey',
  authenticateToken,
  downloadDocument
);

export default router;
