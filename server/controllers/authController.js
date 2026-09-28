import User from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { validateSignupInput, validateLoginInput } from '../utils/validation.js';

const DEMO_ACCOUNT_EMAILS = new Set(['demo@startup.in', 'demo@gov.in']);

function demoAccountsEnabled() {
  return String(process.env.NODE_ENV).toLowerCase() !== 'production' &&
    process.env.SEED_DEMO_USERS === 'true';
}

function isDemoAccountEmail(email) {
  return DEMO_ACCOUNT_EMAILS.has(String(email || '').trim().toLowerCase());
}

export async function signup(req, res, next) {
  try {
    const { isValid, errors, data } = validateSignupInput(req.body);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: errors[0] || 'Invalid signup input',
        errors,
      });
    }

    if (isDemoAccountEmail(data.email) && !demoAccountsEnabled()) {
      return res.status(409).json({
        success: false,
        message: 'This email address is unavailable.',
      });
    }

    // Check for existing user with this email
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Create user (pre-save hook hashes the password)
    const user = await User.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      startupName: data.startupName,
      orgName: data.orgName,
      department: data.department,
      designation: data.designation,
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: user.toPublicJSON(),
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { isValid, errors, data } = validateLoginInput(req.body);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: errors[0] || 'Invalid credentials',
        errors,
      });
    }

    if (isDemoAccountEmail(data.email) && !demoAccountsEnabled()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Find user including the hidden password field
    const user = await User.findOne({ email: data.email }).select('+password +tokenVersion');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toPublicJSON(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res) {
  // req.user is set by authenticateToken middleware
  return res.status(200).json({
    success: true,
    user: req.user.toPublicJSON(),
  });
}

export async function logout(req, res, next) {
  try {
    const result = await User.updateOne(
      { _id: req.user._id },
      { $inc: { tokenVersion: 1 } }
    );
    if (result.matchedCount !== 1) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User session is no longer valid.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
}
