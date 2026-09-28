import StartupProfile from '../models/StartupProfile.js';
import User from '../models/User.js';

export async function getMyProfile(req, res, next) {
  try {
    const userId = req.user.id;

    let profile = await StartupProfile.findOne({ user: userId });

    if (!profile) {
      // Build clean initial profile using user account details
      const user = await User.findById(userId);
      const initial = {
        user: userId,
        startupName: user?.startupName || user?.name || '',
        founderName: user?.name || '',
        email: user?.email || '',
        phone: '',
        website: '',
        location: '',
        industry: '',
        description: '',
        stage: '',
        foundedYear: null,
        teamSize: null,
        dpiit: '',
        technology: '',
        techTags: '',
        deckLink: '',
      };
      return res.status(200).json({
        success: true,
        profile: initial,
        completionPercentage: 0,
        strength: { percent: 0, checklist: [] },
      });
    }

    const payload = profile.toJSON();
    return res.status(200).json({
      success: true,
      profile: payload,
      completionPercentage: profile.completionPercentage,
      strength: profile.strength,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    // Strictly derive user ID from authenticated JWT — never from client body
    const userId = req.user.id;
    const body = req.body || {};

    const errors = [];

    // Basic required validations
    if (!String(body.startupName || '').trim()) {
      errors.push('Startup name is required.');
    }
    if (!String(body.founderName || '').trim()) {
      errors.push('Founder name is required.');
    }
    if (!String(body.email || '').trim() || !/^\S+@\S+\.\S+$/.test(body.email)) {
      errors.push('A valid email address is required.');
    }

    // URL validations
    if (body.website && !/^https?:\/\/.+\..+/.test(body.website)) {
      errors.push('Website must start with http:// or https://');
    }
    if (body.deckLink && !/^https?:\/\/.+\..+/.test(body.deckLink)) {
      errors.push('Deck link must start with http:// or https://');
    }

    // Number validations
    let teamSizeNum = null;
    if (body.teamSize !== '' && body.teamSize !== null && body.teamSize !== undefined) {
      teamSizeNum = Number(body.teamSize);
      if (!Number.isInteger(teamSizeNum) || teamSizeNum < 1 || teamSizeNum > 10000) {
        errors.push('Enter a valid team size (1 to 10,000).');
      }
    }

    let foundedYearNum = null;
    const currentYear = new Date().getFullYear();
    if (body.foundedYear !== '' && body.foundedYear !== null && body.foundedYear !== undefined) {
      foundedYearNum = Number(body.foundedYear);
      if (!Number.isInteger(foundedYearNum) || foundedYearNum < 1990 || foundedYearNum > currentYear) {
        errors.push(`Enter a valid founded year between 1990 and ${currentYear}.`);
      }
    }

    // DPIIT format check
    if (body.dpiit && !/^[A-Z0-9]{6,16}$/i.test(String(body.dpiit).trim())) {
      errors.push('DPIIT registration number must be 6 to 16 alphanumeric characters.');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    // Allowed writable fields only (prevent arbitrary field injection)
    const updateData = {
      startupName: String(body.startupName).trim(),
      founderName: String(body.founderName).trim(),
      email: String(body.email).trim().toLowerCase(),
      phone: String(body.phone || '').trim(),
      website: String(body.website || '').trim(),
      location: String(body.location || '').trim(),
      industry: String(body.industry || '').trim(),
      description: String(body.description || '').trim(),
      stage: String(body.stage || '').trim(),
      foundedYear: foundedYearNum,
      teamSize: teamSizeNum,
      dpiit: String(body.dpiit || '').trim().toUpperCase(),
      technology: String(body.technology || '').trim(),
      techTags: String(body.techTags || '').trim(),
      deckLink: String(body.deckLink || '').trim(),
    };

    const profile = await StartupProfile.findOneAndUpdate(
      { user: userId },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // Also sync startupName on User model if different
    await User.findByIdAndUpdate(userId, {
      startupName: updateData.startupName,
      name: updateData.founderName,
    });

    return res.status(200).json({
      success: true,
      message: 'Profile saved successfully.',
      profile: profile.toJSON(),
      completionPercentage: profile.completionPercentage,
      strength: profile.strength,
    });
  } catch (err) {
    next(err);
  }
}
