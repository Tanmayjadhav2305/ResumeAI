const BACKEND_URL =
  window.__BACKEND_URL__ ||
  (process.env.NODE_ENV === 'production'
    ? 'https://resumeai-gva2.onrender.com'
    : 'http://localhost:8000');

export const API_BASE_URL = `${BACKEND_URL}/api`;