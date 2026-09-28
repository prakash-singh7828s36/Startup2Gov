import { isTokenVersionCurrent, verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authorization token provided.',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Malformed authorization header (expected "Bearer <token>").',
    });
  }

  const token = parts[1];
  const decoded = verifyToken(token);

  if (!decoded || !decoded.id) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Invalid or expired token.',
    });
  }

  try {
    const user = await User.findById(decoded.id).select('+tokenVersion');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid or expired token.',
      });
    }

    if (!isTokenVersionCurrent(decoded.tokenVersion, user.tokenVersion)) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid or expired token.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid or expired token.',
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Failed to authenticate user session.',
    });
  }
}

export async function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    req.user = null;
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    req.user = null;
    return next();
  }

  const decoded = verifyToken(parts[1]);
  if (!decoded || !decoded.id) {
    req.user = null;
    return next();
  }

  try {
    const user = await User.findById(decoded.id).select('+tokenVersion');
    if (
      user &&
      user.isActive &&
      isTokenVersionCurrent(decoded.tokenVersion, user.tokenVersion)
    ) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }

  next();
}

