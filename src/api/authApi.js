import apiClient from './client.js';

export const ROLES = {
  STARTUP: 'startup',
  GOVERNMENT: 'government',
  EVALUATOR: 'evaluator',
  ADMIN: 'admin',
};

export function dashboardForRole(role) {
  return role === ROLES.GOVERNMENT ? '/gov/dashboard' : '/dashboard';
}

export async function signup(payload) {
  const response = await apiClient.post('/auth/signup', payload);
  return response.data;
}

export async function login(credentials) {
  const response = await apiClient.post('/auth/login', credentials);
  return response.data;
}

export async function getMe() {
  const response = await apiClient.get('/auth/me');
  return response.data;
}

export async function logout() {
  try {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  } catch {
    return { success: false };
  }
}

export async function checkHealth() {
  const response = await apiClient.get('/health');
  return response.data;
}
