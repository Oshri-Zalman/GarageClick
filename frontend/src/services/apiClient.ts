import axios, { AxiosError, type AxiosResponse } from 'axios';

// In production, set VITE_API_URL (e.g. https://api.example.com/api) at build time.
// In local dev it falls back to '/api', which the Vite proxy routes to the backend.
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

// Attach JWT token from session storage on every request
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('current_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default apiClient;
