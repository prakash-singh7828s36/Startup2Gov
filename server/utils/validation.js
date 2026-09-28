import { USER_ROLES, PUBLIC_ROLES } from '../models/User.js';

export function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function validateSignupInput(body) {
  const errors = [];
  const { role, email, password, startupName, orgName, department, designation, name } = body;

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  const selectedRole = role ? String(role).trim().toLowerCase() : USER_ROLES.STARTUP;

  // Prevent public signup from assigning evaluator or admin roles
  if (!PUBLIC_ROLES.includes(selectedRole)) {
    errors.push(`Public registration is restricted to 'startup' or 'government' roles only.`);
  }

  const isGov = selectedRole === USER_ROLES.GOVERNMENT;
  const determinedName = isGov
    ? String(orgName || department || name || '').trim()
    : String(startupName || name || '').trim();

  if (!determinedName) {
    errors.push(
      isGov
        ? 'Organisation or department name is required for government accounts.'
        : 'Startup name is required for startup accounts.'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      role: selectedRole,
      email: normalizedEmail,
      password,
      name: determinedName,
      startupName: isGov ? '' : determinedName,
      orgName: isGov ? determinedName : '',
      department: isGov ? String(department || determinedName).trim() : '',
      designation: isGov ? String(designation || '').trim() : '',
    },
  };
}

export function validateLoginInput(body) {
  const errors = [];
  const { email, password } = body;

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      email: normalizedEmail,
      password,
    },
  };
}
