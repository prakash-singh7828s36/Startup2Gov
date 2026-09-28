import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const MIN_SECRET_BYTES = 32;
let ephemeralDevelopmentSecret;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (String(process.env.NODE_ENV).toLowerCase() === 'production') {
      throw new Error('JWT_SECRET must be configured in production.');
    }

    ephemeralDevelopmentSecret ||= crypto.randomBytes(MIN_SECRET_BYTES).toString('hex');
    return ephemeralDevelopmentSecret;
  }

  const normalizedSecret = secret.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isPlaceholder = [
    'your',
    'replace',
    'change',
    'changeme',
    'example',
    'placeholder',
    'default',
    'password',
    'secret',
  ].some((marker) => normalizedSecret.includes(marker));
  if (
    Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES ||
    new Set(secret).size < 12 ||
    isPlaceholder
  ) {
    throw new Error('JWT_SECRET must contain at least 32 bytes of non-placeholder secret material.');
  }

  return secret;
}

export function assertJwtConfiguration() {
  getSecret();
}

export function isTokenVersionCurrent(tokenVersion, storedVersion) {
  const tokenValue = tokenVersion === undefined ? 0 : tokenVersion;
  const storedValue = storedVersion === undefined ? 0 : storedVersion;
  return Number.isSafeInteger(tokenValue) && Number.isSafeInteger(storedValue) && tokenValue === storedValue;
}

export function generateToken(user, expiresIn = process.env.JWT_EXPIRES_IN || '7d') {
  const payload = {
    id: user.id || user._id,
    email: user.email,
    role: user.role,
    tokenVersion: Number.isSafeInteger(user.tokenVersion) ? user.tokenVersion : 0,
  };

  return jwt.sign(payload, getSecret(), { expiresIn, algorithm: 'HS256' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}
