import mongoose from 'mongoose';
import Challenge, { CHALLENGE_STATUS } from '../models/Challenge.js';
import StartupProfile from '../models/StartupProfile.js';
import { calculateMatchScore } from '../services/matchingService.js';
import { slugify } from '../utils/slug.js';
import { SEED_CHALLENGES } from '../scripts/seedChallenges.js';

function throwIfProductionDatabaseUnavailable() {
  if (String(process.env.NODE_ENV).toLowerCase() !== 'production') return;

  const error = new Error('Challenge data is temporarily unavailable until the database is connected.');
  error.statusCode = 503;
  throw error;
}

// Helper to look up challenge by ObjectId, customId, or slug
export async function findChallengeByIdOrIdentifier(identifier) {
  if (!identifier) return null;

  if (mongoose.connection.readyState !== 1) {
    throwIfProductionDatabaseUnavailable();
    const num = Number(identifier);
    const slugStr = String(identifier).toLowerCase();
    const match = SEED_CHALLENGES.find(
      (c) =>
        c.customId === num ||
        slugify(c.title) === slugStr ||
        `${slugify(c.title)}-${c.customId}` === slugStr
    );
    if (!match) return null;
    return {
      ...match,
      id: String(match.customId),
      status: CHALLENGE_STATUS.OPEN,
      toJSON: () => ({ id: String(match.customId), ...match, status: CHALLENGE_STATUS.OPEN }),
    };
  }

  const conditions = [];

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    conditions.push({ _id: identifier });
  }

  const num = Number(identifier);
  if (!Number.isNaN(num) && Number.isFinite(num)) {
    conditions.push({ customId: num });
  }

  conditions.push({ slug: identifier.toLowerCase() });

  return Challenge.findOne({ $or: conditions });
}

export async function listChallenges(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { category, search, sort = 'match', status } = req.query;

    const query = {};

    // Draft visibility rule: public/startup queries can NEVER see Draft challenges
    if (status && status !== 'All') {
      if (status === CHALLENGE_STATUS.DRAFT) {
        // Only government owners can view drafts, and only via their owned list or explicit filter
        if (req.user?.role !== 'government' && req.user?.role !== 'admin') {
          return res.status(403).json({
            success: false,
            message: 'Startups and public visitors cannot view unpublished draft challenges.',
          });
        }
        query.status = CHALLENGE_STATUS.DRAFT;
        query.createdBy = req.user.id;
      } else if (Object.values(CHALLENGE_STATUS).includes(status)) {
        query.status = status;
      }
    } else {
      // Default: exclude Drafts for public listings
      query.status = { $ne: CHALLENGE_STATUS.DRAFT };
    }

    // Offline / Disconnected Fallback
    if (mongoose.connection.readyState !== 1) {
      throwIfProductionDatabaseUnavailable();
      let list = SEED_CHALLENGES.map((c) => ({
        id: String(c.customId),
        ...c,
        status: CHALLENGE_STATUS.OPEN,
      }));
      if (category && category !== 'All') {
        list = list.filter((c) => c.category === category);
      }
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.department.toLowerCase().includes(q) ||
            (c.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      }
      return res.status(200).json({
        success: true,
        count: list.length,
        total: list.length,
        page: 1,
        totalPages: 1,
        challenges: list,
      });
    }


    // Category filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // Search query
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { title: regex },
        { department: regex },
        { location: regex },
        { category: regex },
        { tags: regex },
      ];
    }

    // Sorting
    let sortOptions = {};
    if (sort === 'deadline') {
      sortOptions = { deadlineDate: 1 };
    } else if (sort === 'newest') {
      sortOptions = { postedDate: -1 };
    } else {
      // Default natural order: featured first, then newest
      sortOptions = { featured: -1, postedDate: -1 };
    }

    const [total, challenges] = await Promise.all([
      Challenge.countDocuments(query),
      Challenge.find(query).sort(sortOptions).skip(skip).limit(limit),
    ]);

    // If startup user and sort === 'match', calculate match scores
    let payload = challenges.map((c) => c.toJSON());

    if (req.user?.role === 'startup' && req.user?.id) {
      const profile = await StartupProfile.findOne({ user: req.user.id });
      if (profile) {
        payload = payload.map((ch) => {
          const match = calculateMatchScore(profile.toJSON(), ch);
          return {
            ...ch,
            matchScore: match.score,
            matchReasons: match.reasons,
            matchMissing: match.missing,
          };
        });

        if (sort === 'match') {
          payload.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
        }
      }
    }

    return res.status(200).json({
      success: true,
      count: payload.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      challenges: payload,
    });
  } catch (err) {
    next(err);
  }
}

export async function getChallenge(req, res, next) {
  try {
    const { id } = req.params;
    const challenge = await findChallengeByIdOrIdentifier(id);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: `Challenge not found with identifier '${id}'.`,
      });
    }

    // Draft visibility restriction
    if (challenge.status === CHALLENGE_STATUS.DRAFT) {
      const isOwner =
        req.user &&
        (req.user.role === 'admin' ||
          challenge.createdBy?.toString() === req.user.id ||
          challenge.createdBy?.toString() === req.user._id?.toString());

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'This challenge is an unpublished draft and is not accessible.',
        });
      }
    }

    const payload = challenge.toJSON();

    // If authenticated startup, compute matching score
    if (req.user?.role === 'startup' && req.user?.id) {
      const profile = await StartupProfile.findOne({ user: req.user.id });
      if (profile) {
        const match = calculateMatchScore(profile.toJSON(), payload);
        payload.matchScore = match.score;
        payload.matchReasons = match.reasons;
        payload.matchMissing = match.missing;
      }
    }

    return res.status(200).json({
      success: true,
      challenge: payload,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOwnedChallenges(req, res, next) {
  try {
    // Authenticated government or admin user
    const query = { createdBy: req.user.id };

    const challenges = await Challenge.find(query).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: challenges.length,
      challenges: challenges.map((c) => c.toJSON()),
    });
  } catch (err) {
    next(err);
  }
}

export async function createChallenge(req, res, next) {
  try {
    const {
      title,
      department,
      category,
      problemStatement,
      description,
      location,
      budget,
      duration,
      requirements,
      tags,
      matchKeywords,
      eligibility,
      deadline,
      deadlineDate,
      status,
    } = req.body;

    // Required fields validation
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Challenge title is required.' });
    }
    if (!department || !String(department).trim()) {
      return res.status(400).json({ success: false, message: 'Department is required.' });
    }
    if (!category || !String(category).trim()) {
      return res.status(400).json({ success: false, message: 'Category is required.' });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ success: false, message: 'Description is required.' });
    }
    if (!deadlineDate) {
      return res.status(400).json({ success: false, message: 'Application deadline date is required.' });
    }

    // Process requirements & tags
    const reqs = Array.isArray(requirements)
      ? requirements.map((r) => String(r).trim()).filter(Boolean)
      : String(requirements || '')
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean);

    const tagList = Array.isArray(tags)
      ? tags.map((t) => String(t).trim()).filter(Boolean)
      : String(tags || '')
          .split(/[,|\n]/)
          .map((t) => t.trim())
          .filter(Boolean);

    // Get max customId for clean ordering
    const highestCustom = await Challenge.findOne().sort({ customId: -1 });
    const nextCustomId = Math.max(1001, (highestCustom?.customId || 1000) + 1);

    const parsedDeadline = new Date(deadlineDate);
    const deadlineStr =
      deadline ||
      parsedDeadline.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

    const newChallenge = await Challenge.create({
      customId: nextCustomId,
      slug: `${slugify(title)}-${nextCustomId}`,
      title: title.trim(),
      department: department.trim(),
      category: category.trim(),
      problemStatement: (problemStatement || description).trim(),
      description: description.trim(),
      location: (location || 'Pan-India').trim(),
      budget: (budget || 'Pilot grant (TBD)').trim(),
      duration: (duration || '6-month pilot').trim(),
      requirements: reqs,
      tags: tagList,
      matchKeywords: Array.isArray(matchKeywords) && matchKeywords.length ? matchKeywords : tagList,
      eligibility: {
        stages: eligibility?.stages || ['Idea', 'MVP', 'Early Revenue', 'Growth'],
        needsDPIIT: Boolean(eligibility?.needsDPIIT),
        minTeam: Number(eligibility?.minTeam) || 1,
        note: (eligibility?.note || 'Open to DPIIT-recognised and early-stage startups.').trim(),
      },
      deadline: deadlineStr,
      deadlineDate: parsedDeadline,
      postedDate: new Date(),
      status: Object.values(CHALLENGE_STATUS).includes(status) ? status : CHALLENGE_STATUS.OPEN,
      createdBy: req.user.id,
      createdByName: req.user.displayName || req.user.name || req.user.orgName || '',
      isDemo: false,
    });

    return res.status(201).json({
      success: true,
      message: 'Challenge created successfully.',
      challenge: newChallenge.toJSON(),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateChallenge(req, res, next) {
  try {
    const { id } = req.params;
    const challenge = await findChallengeByIdOrIdentifier(id);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: `Challenge not found with identifier '${id}'.`,
      });
    }

    // Ownership check: government user must own the challenge (or be admin)
    const isOwner =
      req.user.role === 'admin' ||
      challenge.createdBy?.toString() === req.user.id ||
      challenge.createdBy?.toString() === req.user._id?.toString();

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit challenges created by your department.',
      });
    }

    // Explicitly select writable fields to prevent mass assignment
    const patch = req.body;
    if (patch.title !== undefined) challenge.title = String(patch.title).trim();
    if (patch.department !== undefined) challenge.department = String(patch.department).trim();
    if (patch.category !== undefined) challenge.category = String(patch.category).trim();
    if (patch.problemStatement !== undefined) challenge.problemStatement = String(patch.problemStatement).trim();
    if (patch.description !== undefined) challenge.description = String(patch.description).trim();
    if (patch.location !== undefined) challenge.location = String(patch.location).trim();
    if (patch.budget !== undefined) challenge.budget = String(patch.budget).trim();
    if (patch.duration !== undefined) challenge.duration = String(patch.duration).trim();
    if (patch.featured !== undefined && req.user.role === 'admin') challenge.featured = Boolean(patch.featured);

    if (patch.requirements !== undefined) {
      challenge.requirements = Array.isArray(patch.requirements)
        ? patch.requirements.map((r) => String(r).trim()).filter(Boolean)
        : String(patch.requirements || '')
            .split('\n')
            .map((r) => r.trim())
            .filter(Boolean);
    }

    if (patch.tags !== undefined) {
      const tagList = Array.isArray(patch.tags)
        ? patch.tags.map((t) => String(t).trim()).filter(Boolean)
        : String(patch.tags || '')
            .split(/[,|\n]/)
            .map((t) => t.trim())
            .filter(Boolean);
      challenge.tags = tagList;
      if (!patch.matchKeywords) {
        challenge.matchKeywords = tagList;
      }
    }

    if (patch.eligibility !== undefined) {
      challenge.eligibility = {
        stages: patch.eligibility.stages || challenge.eligibility.stages,
        needsDPIIT:
          patch.eligibility.needsDPIIT !== undefined
            ? Boolean(patch.eligibility.needsDPIIT)
            : challenge.eligibility.needsDPIIT,
        minTeam:
          patch.eligibility.minTeam !== undefined
            ? Number(patch.eligibility.minTeam)
            : challenge.eligibility.minTeam,
        note:
          patch.eligibility.note !== undefined
            ? String(patch.eligibility.note).trim()
            : challenge.eligibility.note,
      };
    }

    if (patch.deadlineDate) {
      const parsedDeadline = new Date(patch.deadlineDate);
      challenge.deadlineDate = parsedDeadline;
      challenge.deadline =
        patch.deadline ||
        parsedDeadline.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
    }

    if (patch.status && Object.values(CHALLENGE_STATUS).includes(patch.status)) {
      challenge.status = patch.status;
    }

    await challenge.save();

    return res.status(200).json({
      success: true,
      message: 'Challenge updated successfully.',
      challenge: challenge.toJSON(),
    });
  } catch (err) {
    next(err);
  }
}

export async function setChallengeStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !Object.values(CHALLENGE_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${Object.values(CHALLENGE_STATUS).join(', ')}.`,
      });
    }

    const challenge = await findChallengeByIdOrIdentifier(id);
    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: `Challenge not found with identifier '${id}'.`,
      });
    }

    const isOwner =
      req.user.role === 'admin' ||
      challenge.createdBy?.toString() === req.user.id ||
      challenge.createdBy?.toString() === req.user._id?.toString();

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only alter status for challenges created by your department.',
      });
    }

    challenge.status = status;
    await challenge.save();

    return res.status(200).json({
      success: true,
      message: `Challenge status updated to ${status}.`,
      challenge: challenge.toJSON(),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteChallenge(req, res, next) {
  try {
    const { id } = req.params;
    const challenge = await findChallengeByIdOrIdentifier(id);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: `Challenge not found with identifier '${id}'.`,
      });
    }

    // Guard core demo challenges against accidental deletion
    if (challenge.isDemo && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Public demo challenges cannot be deleted.',
      });
    }

    const isOwner =
      req.user.role === 'admin' ||
      challenge.createdBy?.toString() === req.user.id ||
      challenge.createdBy?.toString() === req.user._id?.toString();

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete challenges created by your department.',
      });
    }

    await Challenge.findByIdAndDelete(challenge._id);

    return res.status(200).json({
      success: true,
      message: 'Challenge deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
}
