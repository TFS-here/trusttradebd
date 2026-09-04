import axios from 'axios';

/**
 * Unified Axios client instance with central configuration,
 * automated authorization header injection, and global error handling.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 30000,
});

// ── Request Interceptor: Attach JWT ──────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const isAdminRoute = config.url?.includes('/admin');
    const token = isAdminRoute
      ? localStorage.getItem('tt_admin_token') || localStorage.getItem('tt_token')
      : localStorage.getItem('tt_token') || localStorage.getItem('tt_admin_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor: Global 401 & Error Formatting ──────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isUrlAdmin = error.config?.url?.includes('/admin');

    if (status === 401) {
      if (isUrlAdmin) {
        localStorage.removeItem('tt_admin_token');
        if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
          window.location.href = '/admin/login';
        }
      } else {
        localStorage.removeItem('tt_token');
      }
    }

    // Attach user-friendly parsed message
    const customMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred. Please try again.';

    error.friendlyMessage = customMessage;
    return Promise.reject(error);
  }
);

export default apiClient;
export { apiClient };
