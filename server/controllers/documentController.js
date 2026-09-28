import multer from 'multer';
import {
  DocumentValidationError,
  storeFile,
  getFileStream,
  MAX_FILE_SIZE,
} from '../storage/storageAdapter.js';
import Application from '../models/Application.js';
import Draft from '../models/Draft.js';
import Challenge from '../models/Challenge.js';

// Multer memory storage configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const parseDocumentUpload = upload.single('document');

export function documentUploadMiddleware(req, res, next) {
  parseDocumentUpload(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'File size exceeds the 5MB limit.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid document upload request.',
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid multipart document upload.',
    });
  });
}

export async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document file was provided in the upload request.',
      });
    }

    const fileMeta = await storeFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    return res.status(201).json({
      success: true,
      message: 'Document uploaded and securely stored.',
      document: {
        name: fileMeta.originalName,
        originalName: fileMeta.originalName,
        storageKey: fileMeta.storageKey,
        size: fileMeta.size,
        mimeType: fileMeta.mimeType,
        url: `/api/documents/${fileMeta.storageKey}`,
        uploadedAt: fileMeta.uploadedAt,
      },
    });
  } catch (err) {
    if (err instanceof DocumentValidationError) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Document storage failed. Please try again later.',
    });
  }
}

export async function downloadDocument(req, res) {
  try {
    const { storageKey } = req.params;
    if (!storageKey) {
      return res.status(400).json({ success: false, message: 'Storage key is required.' });
    }

    const fileInfo = getFileStream(storageKey);
    if (!fileInfo) {
      return res.status(404).json({ success: false, message: 'Document not found in storage.' });
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    let isAuthorized = userRole === 'admin';

    if (!isAuthorized) {
      // 1. Check if attached to an Application
      const application = await Application.findOne({
        'document.storageKey': storageKey,
      });

      if (application) {
        // Applicant check
        if (application.user?.toString() === userId) {
          isAuthorized = true;
        } else {
          // Government challenge owner check
          const challenge = await Challenge.findById(application.challenge);
          if (
            challenge &&
            challenge.createdBy &&
            challenge.createdBy.toString() === userId
          ) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      // 2. Check if attached to a Draft
      const draft = await Draft.findOne({
        'documentMetadata.storageKey': storageKey,
      });
      if (draft && draft.user?.toString() === userId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to download this proposal document.',
      });
    }

    // Set secure download headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${storageKey}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    fileInfo.stream.pipe(res);
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Document could not be retrieved.',
    });
  }
}
