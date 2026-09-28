import axios from 'axios';

// Base URL: in dev with Vite proxy, '/api' routes to backend server on port 5000.
// In production or separate deploy, VITE_API_URL can point to full backend URL.
const baseURL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

function isApiDestination(config) {
  try {
    const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    const apiBase = new URL(baseURL, origin);
    const requestUrl = new URL(apiClient.getUri({ ...config, baseURL }), origin);
    const basePath = apiBase.pathname.replace(/\/+$/, '') || '/';
    const matchesPath =
      basePath === '/' ||
      requestUrl.pathname === basePath ||
      requestUrl.pathname.startsWith(`${basePath}/`);
    return requestUrl.origin === apiBase.origin && matchesPath;
  } catch {
    return false;
  }
}

// Request interceptor: attach JWT bearer token if present in storage
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('s2g_token');
    if (token && isApiDestination(config)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 unauthenticated responses cleanly
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && isApiDestination(error.config || {})) {
      localStorage.removeItem('s2g_token');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
