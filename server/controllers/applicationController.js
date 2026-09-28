import mongoose from 'mongoose';
import Application, {
  APPLICATION_STATUS,
  ALLOWED_STATUS_TRANSITIONS,
} from '../models/Application.js';
import Draft from '../models/Draft.js';
import Challenge, { CHALLENGE_STATUS } from '../models/Challenge.js';
import { findChallengeByIdOrIdentifier } from './challengeController.js';

// In-memory fallback applications for offline test mode
let fallbackApplications = [];
let fallbackDrafts = {};

function rejectProductionDatabaseFallback(res) {
  if (String(process.env.NODE_ENV).toLowerCase() !== 'production') return false;

  res.status(503).json({
    success: false,
    message: 'This operation is temporarily unavailable until the database is connected.',
  });
  return true;
}

export async function getDraft(req, res, next) {
  try {
    const { challengeId } = req.params;
    const userId = req.user.id;

    if (mongoose.connection.readyState !== 1) {
      if (rejectProductionDatabaseFallback(res)) return;
      const key = `${userId}:${challengeId}`;
      const draft = fallbackDrafts[key] || null;
      return res.status(200).json({ success: true, draft });
    }

    const draft = await Draft.findOne({ user: userId, challengeId });
    if (!draft) {
      return res.status(200).json({ success: true, draft: null });
    }

    return res.status(200).json({
      success: true,
      draft: {
        data: {
          formData: draft.formData,
          documentName: draft.documentMetadata?.name,
          document: draft.documentMetadata,
        },
        updatedAt: draft.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function saveDraft(req, res, next) {
  try {
    const { challengeId } = req.params;
    const userId = req.user.id;
    const { formData, documentName, document } = req.body || {};

    const docMeta = {
      name: documentName || document?.name || '',
      storageKey: document?.storageKey || '',
      size: document?.size || 0,
      mimeType: document?.mimeType || '',
    };

    if (mongoose.connection.readyState !== 1) {
      if (rejectProductionDatabaseFallback(res)) return;
      const key = `${userId}:${challengeId}`;
      const saved = {
        data: { formData: formData || {}, documentName: docMeta.name, document: docMeta },
        updatedAt: new Date().toISOString(),
      };
      fallbackDrafts[key] = saved;
      return res.status(200).json({ success: true, draft: saved });
    }

    const draft = await Draft.findOneAndUpdate(
      { user: userId, challengeId },
      {
        $set: {
          formData: formData || {},
          documentMetadata: docMeta,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      draft: {
        data: {
          formData: draft.formData,
          documentName: draft.documentMetadata?.name,
          document: draft.documentMetadata,
        },
        updatedAt: draft.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function clearDraft(req, res, next) {
  try {
    const { challengeId } = req.params;
    const userId = req.user.id;

    if (mongoose.connection.readyState !== 1) {
      if (rejectProductionDatabaseFallback(res)) return;
      delete fallbackDrafts[`${userId}:${challengeId}`];
      return res.status(200).json({ success: true, message: 'Draft cleared.' });
    }

    await Draft.findOneAndDelete({ user: userId, challengeId });
    return res.status(200).json({ success: true, message: 'Draft cleared.' });
  } catch (err) {
    next(err);
  }
}

export async function submitApplication(req, res, next) {
  try {
    const userId = req.user.id;
    const body = req.body || {};

    const challengeIdentifier = body.challengeId || body.challenge?.id || body.challenge?._id;
    if (!challengeIdentifier) {
      return res.status(400).json({ success: false, message: 'Challenge ID is required.' });
    }

    const challenge = await findChallengeByIdOrIdentifier(challengeIdentifier);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found.' });
    }

    // Check challenge status
    if (challenge.status !== CHALLENGE_STATUS.OPEN) {
      return res.status(400).json({
        success: false,
        message: `Applications are not currently accepted for this challenge (Status: ${challenge.status}).`,
      });
    }

    // Check application deadline
    if (challenge.deadlineDate && new Date(challenge.deadlineDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'The deadline for applying to this challenge has passed.',
      });
    }

    // Required fields validation
    const requiredFields = [
      'startupName',
      'contactPerson',
      'solutionTitle',
      'solutionDescription',
      'challengeSolution',
      'expectedImpact',
      'technology',
    ];

    for (const f of requiredFields) {
      if (!String(body[f] || '').trim()) {
        return res.status(400).json({
          success: false,
          message: `Field '${f}' is required for proposal submission.`,
        });
      }
    }

    const challengeKey = String(challenge.customId || challenge._id || challengeIdentifier);

    // Duplicate submission check
    if (mongoose.connection.readyState === 1) {
      const existing = await Application.findOne({
        user: userId,
        challengeId: challengeKey,
        status: { $ne: APPLICATION_STATUS.WITHDRAWN },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'You have already submitted an active application to this challenge.',
        });
      }

      const now = new Date();
      const submittedOnStr = now.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      const application = new Application({
        user: userId,
        challenge: challenge._id || null,
        challengeId: challengeKey,
        challengeTitle: challenge.title,
        department: challenge.department,
        startupName: body.startupName.trim(),
        contactPerson: body.contactPerson.trim(),
        solutionTitle: body.solutionTitle.trim(),
        solutionDescription: body.solutionDescription.trim(),
        challengeSolution: body.challengeSolution.trim(),
        expectedImpact: body.expectedImpact.trim(),
        technology: body.technology.trim(),
        document: body.document
          ? {
              originalName: body.document.originalName || body.document.name,
              storageKey: body.document.storageKey,
              mimeType: body.document.mimeType || body.document.type,
              size: body.document.size,
              url: body.document.url,
              uploadedAt: new Date(),
            }
          : null,
        status: APPLICATION_STATUS.PENDING,
        submittedOn: submittedOnStr,
        submittedAt: now,
        statusHistory: [
          {
            status: APPLICATION_STATUS.PENDING,
            changedBy: userId,
            changedByName: req.user.name || req.user.startupName || 'Applicant',
            changedAt: now,
            note: 'Application submitted',
          },
        ],
      });
      application.applicationNumber = `APP-${now.getFullYear()}-${application._id
        .toString()
        .toUpperCase()}`;
      await application.save();

      // Clear draft after successful submission
      await Draft.findOneAndDelete({ user: userId, challengeId: challengeKey }).catch(() => {});

      return res.status(201).json({
        success: true,
        message: 'Application submitted successfully.',
        application: application.toJSON(),
      });
    } else {
      return res.status(503).json({
        success: false,
        message: 'Application submissions are temporarily unavailable until the database is connected.',
      });
    }
  } catch (err) {
    next(err);
  }
}

export async function getMyApplications(req, res, next) {
  try {
    const userId = req.user.id;

    if (mongoose.connection.readyState !== 1) {
      if (rejectProductionDatabaseFallback(res)) return;
      const list = fallbackApplications.filter((a) => a.userId === userId);
      return res.status(200).json({
        success: true,
        count: list.length,
        applications: list,
      });
    }

    const applications = await Application.find({ user: userId }).sort({ submittedAt: -1 });

    return res.status(200).json({
      success: true,
      count: applications.length,
      applications: applications.map((a) => a.toJSON()),
    });
  } catch (err) {
    next(err);
  }
}

export async function getApplicationById(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    let application = null;

    if (mongoose.connection.readyState === 1) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        application = await Application.findById(id);
      }
      if (!application) {
        application = await Application.findOne({ applicationNumber: id });
      }
    } else {
      if (rejectProductionDatabaseFallback(res)) return;
      application = fallbackApplications.find((a) => a.id === id || a.applicationNumber === id);
    }

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const appObj = application.toJSON ? application.toJSON() : application;

    // Authorization check
    let authorized = userRole === 'admin';
    if (!authorized) {
      if (userRole === 'startup') {
        authorized = (appObj.user || appObj.userId)?.toString() === userId;
      } else if (userRole === 'government') {
        const challenge = await findChallengeByIdOrIdentifier(appObj.challengeId || appObj.challenge);
        if (challenge?.createdBy?.toString() === userId) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view this application.',
      });
    }

    return res.status(200).json({ success: true, application: appObj });
  } catch (err) {
    next(err);
  }
}

export async function withdrawApplication(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    let application = null;

    if (mongoose.connection.readyState === 1) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        application = await Application.findById(id);
      }
      if (!application) {
        application = await Application.findOne({ applicationNumber: id });
      }

      if (!application) {
        return res.status(404).json({ success: false, message: 'Application not found.' });
      }

      // Check ownership
      if (application.user.toString() !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only withdraw your own applications.',
        });
      }

      // Check status
      if (application.status === APPLICATION_STATUS.APPROVED) {
        return res.status(400).json({
          success: false,
          message: 'Approved applications cannot be withdrawn. Please contact the department.',
        });
      }

      application.status = APPLICATION_STATUS.WITHDRAWN;
      application.statusHistory.push({
        status: APPLICATION_STATUS.WITHDRAWN,
        changedBy: userId,
        changedByName: req.user.name || 'Applicant',
        changedAt: new Date(),
        note: 'Application withdrawn by startup',
      });

      await application.save();
      return res.status(200).json({
        success: true,
        message: 'Application withdrawn successfully.',
        application: application.toJSON(),
      });
    } else {
      if (rejectProductionDatabaseFallback(res)) return;
      const idx = fallbackApplications.findIndex((a) => a.id === id || a.applicationNumber === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Application not found.' });
      }
      if (fallbackApplications[idx].userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Not your application.' });
      }
      fallbackApplications[idx].status = APPLICATION_STATUS.WITHDRAWN;
      return res.status(200).json({
        success: true,
        message: 'Application withdrawn successfully.',
        application: fallbackApplications[idx],
      });
    }
  } catch (err) {
    next(err);
  }
}

export async function getGovInbox(req, res, next) {
  try {
    const userId = req.user.id;
    const { challengeId, status, search } = req.query;

    let ownedChallengeKeys = [];

    if (req.user.role === 'admin') {
      ownedChallengeKeys = null; // Admin sees all
    } else {
      // Find challenges owned by this government officer
      if (mongoose.connection.readyState === 1) {
        const owned = await Challenge.find({ createdBy: userId });
        ownedChallengeKeys = owned.map((c) => String(c.customId || c._id));
      } else {
        ownedChallengeKeys = [];
      }
    }

    let applications = [];

    if (mongoose.connection.readyState === 1) {
      const query = {};

      if (ownedChallengeKeys !== null) {
        query.challengeId = { $in: ownedChallengeKeys };
      }

      if (status && status !== 'All') {
        query.status = status;
      }

      if (challengeId && challengeId !== 'All') {
        query.challengeId = challengeId;
      }

      if (search && search.trim()) {
        const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(q, 'i');
        query.$or = [
          { startupName: regex },
          { solutionTitle: regex },
          { contactPerson: regex },
          { technology: regex },
        ];
      }

      applications = await Application.find(query).sort({ submittedAt: -1 });
    } else {
      if (rejectProductionDatabaseFallback(res)) return;
      applications = fallbackApplications.filter((a) => {
        if (ownedChallengeKeys !== null && ownedChallengeKeys.length > 0) {
          if (!ownedChallengeKeys.includes(String(a.challengeId))) return false;
        }
        if (status && status !== 'All' && a.status !== status) return false;
        if (challengeId && challengeId !== 'All' && String(a.challengeId) !== String(challengeId)) return false;
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          const match =
            a.startupName?.toLowerCase().includes(q) ||
            a.solution?.toLowerCase().includes(q) ||
            a.solutionTitle?.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });
    }

    const payload = applications.map((a) => (a.toJSON ? a.toJSON() : a));

    // Calculate queue stats
    const byStatus = (s) => payload.filter((a) => a.status === s).length;
    const stats = {
      total: payload.length,
      pending: byStatus(APPLICATION_STATUS.PENDING),
      underReview: byStatus(APPLICATION_STATUS.UNDER_REVIEW),
      approved: byStatus(APPLICATION_STATUS.APPROVED),
      rejected: byStatus(APPLICATION_STATUS.REJECTED),
      inProgress: byStatus(APPLICATION_STATUS.PENDING) + byStatus(APPLICATION_STATUS.UNDER_REVIEW),
    };

    return res.status(200).json({
      success: true,
      count: payload.length,
      stats,
      applications: payload,
    });
  } catch (err) {
    next(err);
  }
}

export async function reviewApplication(req, res, next) {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const reviewerId = req.user.id;
    const reviewerName = req.user.name || req.user.orgName || 'Government Officer';

    if (!status || !Object.values(APPLICATION_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid review status. Allowed values: ${Object.values(APPLICATION_STATUS).join(', ')}.`,
      });
    }

    let application = null;

    if (mongoose.connection.readyState === 1) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        application = await Application.findById(id);
      }
      if (!application) {
        application = await Application.findOne({ applicationNumber: id });
      }

      if (!application) {
        return res.status(404).json({ success: false, message: 'Application not found.' });
      }

      // Check ownership: current government officer must own the challenge
      if (req.user.role !== 'admin') {
        const challenge = await Challenge.findById(application.challenge);
        if (!challenge || challenge.createdBy?.toString() !== reviewerId) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You can only review applications submitted to challenges owned by your department.',
          });
        }
      }

      // Validate status transition
      const currentStatus = application.status;
      const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
      if (currentStatus !== status && !allowedTransitions.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Illegal transition from '${currentStatus}' to '${status}'. Allowed: ${allowedTransitions.join(', ')}.`,
        });
      }

      const now = new Date();
      application.status = status;
      application.reviewNote = String(note || '').trim();
      application.reviewedBy = reviewerId;
      application.reviewedByName = reviewerName;
      application.reviewedAt = now;

      application.statusHistory.push({
        status,
        changedBy: reviewerId,
        changedByName: reviewerName,
        changedAt: now,
        note: String(note || '').trim() || `Status updated to ${status}`,
      });

      await application.save();

      return res.status(200).json({
        success: true,
        message: `Application status updated to ${status}.`,
        application: application.toJSON(),
      });
    } else {
      if (rejectProductionDatabaseFallback(res)) return;
      const idx = fallbackApplications.findIndex((a) => a.id === id || a.applicationNumber === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Application not found.' });
      }
      fallbackApplications[idx].status = status;
      fallbackApplications[idx].reviewNote = note || '';
      fallbackApplications[idx].reviewedBy = reviewerId;
      fallbackApplications[idx].reviewedByName = reviewerName;
      fallbackApplications[idx].reviewedAt = new Date().toISOString();
      return res.status(200).json({
        success: true,
        message: `Application status updated to ${status}.`,
        application: fallbackApplications[idx],
      });
    }
  } catch (err) {
    next(err);
  }
}
