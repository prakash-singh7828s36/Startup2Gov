import { KEYS, getJSON, setJSON, uid, delay } from "./mockDb.js";
import { logActivity } from "./activity.js";
import { DEMO_MODE } from "./demoMode.js";

// MOCK auth only — passwords stored obfuscated, never do this in production.
// Real implementation should call Supabase Auth and never touch localStorage like this.
// Roles: 'startup' | 'government'. Legacy rows without a role default to 'startup'.

export const ROLES = {
  STARTUP: "startup",
  GOVERNMENT: "government",
};

export const GOV_DEMO = { email: "demo@gov.in", password: "password123" };
export const STARTUP_DEMO = { email: "demo@startup.in", password: "password123" };

function requireDemoMode() {
  if (!DEMO_MODE) {
    throw new Error("Demo authentication is disabled. Set VITE_DEMO_MODE=true to enable it.");
  }
}

function encode(pw) {
  try {
    return btoa(String(pw));
  } catch {
    return String(pw);
  }
}

function normalizeRole(role) {
  return role === ROLES.GOVERNMENT ? ROLES.GOVERNMENT : ROLES.STARTUP;
}

function ensureSeedUsers(users) {
  let changed = false;
  const hasGovDemo = users.some(
    (u) => u.email === GOV_DEMO.email
  );
  if (!hasGovDemo) {
    users.push({
      id: "user_gov_demo",
      role: ROLES.GOVERNMENT,
      startupName: "",
      orgName: "Urban Development Department",
      designation: "Nodal Officer",
      email: GOV_DEMO.email,
      password: encode(GOV_DEMO.password),
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }
  const hasStartupDemo = users.some(
    (u) => u.email === STARTUP_DEMO.email
  );
  if (!hasStartupDemo) {
    users.push({
      id: "user_startup_demo",
      role: ROLES.STARTUP,
      startupName: "Smart Waste AI",
      email: STARTUP_DEMO.email,
      password: encode(STARTUP_DEMO.password),
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }
  if (changed) setJSON(KEYS.users, users);
  return users;
}

export async function signup({
  role,
  startupName,
  orgName,
  department,
  designation,
  email,
  password,
}) {
  requireDemoMode();
  await delay(300);
  let users = ensureSeedUsers(getJSON(KEYS.users, []));
  const normalized = String(email).trim().toLowerCase();
  if (users.some((u) => u.email === normalized)) {
    throw new Error("An account with this email already exists.");
  }
  const resolvedRole = normalizeRole(role);
  const isGov = resolvedRole === ROLES.GOVERNMENT;
  const displayName = isGov
    ? String(orgName || department || "").trim()
    : String(startupName || "").trim();
  if (!displayName) {
    throw new Error(
      isGov ? "Organisation / department is required." : "Startup name is required."
    );
  }
  const user = {
    id: uid("user"),
    role: resolvedRole,
    startupName: isGov ? "" : displayName,
    orgName: isGov ? displayName : "",
    department: isGov ? String(department || displayName).trim() : "",
    designation: isGov ? String(designation || "").trim() : "",
    email: normalized,
    password: encode(password),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  setJSON(KEYS.users, users);
  setJSON(KEYS.session, { userId: user.id, email: user.email });
  await logActivity(
    user.id,
    "signup",
    `Account created for ${displayName} (${resolvedRole})`
  ).catch(() => {});
  return publicUser(user);
}

export async function login({ email, password }) {
  requireDemoMode();
  await delay(300);
  const users = ensureSeedUsers(getJSON(KEYS.users, []));
  const normalized = String(email).trim().toLowerCase();
  const user = users.find((u) => u.email === normalized);
  if (!user || user.password !== encode(password)) {
    throw new Error("Invalid email or password.");
  }
  // Backfill legacy rows so old sessions keep working.
  if (!user.role) {
    user.role = ROLES.STARTUP;
    setJSON(KEYS.users, users);
  }
  setJSON(KEYS.session, { userId: user.id, email: user.email });
  return publicUser(user);
}

export async function logout() {
  await delay(100);
  localStorage.removeItem(KEYS.session);
}

export async function getSessionUser() {
  requireDemoMode();
  await delay(100);
  const session = getJSON(KEYS.session, null);
  if (!session?.userId) return null;
  const users = ensureSeedUsers(getJSON(KEYS.users, []));
  const user = users.find((u) => u.id === session.userId);
  return user ? publicUser(user) : null;
}

export function publicUser(user) {
  if (!user) return null;
  const role = normalizeRole(user.role);
  return {
    id: user.id,
    role,
    startupName: user.startupName || "",
    // Government display fields
    orgName: user.orgName || user.department || "",
    department: user.department || user.orgName || "",
    designation: user.designation || "",
    // Convenience display name for headers/sidebars
    displayName:
      role === ROLES.GOVERNMENT
        ? user.orgName || user.department || user.email
        : user.startupName || user.email,
    email: user.email,
  };
}

export function dashboardForRole(role) {
  return normalizeRole(role) === ROLES.GOVERNMENT
    ? "/gov/dashboard"
    : "/dashboard";
}
