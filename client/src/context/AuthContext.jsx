import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// ── Axios instance ────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Export for use in other api modules
export { api };

// ── Context ───────────────────────────────────────────────────────
const AuthContext = createContext(null);

/**
 * AuthProvider
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for authentication state.
 *
 * Provides:
 *   user          — current user object (null if unauthenticated)
 *   loading       — true while hydrating from token on first mount
 *   login()       — authenticate with email + password
 *   register()    — create account (returns { status:'pending', email } — no JWT yet)
 *   verifyEmail() — submit OTP, receive JWT and log in
 *   resendOtp()   — resend the OTP to email
 *   logout()      — clear session
 *   updateUser()  — patch local user state after profile updates
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // hydrating on mount

  // ── Hydrate from stored token ─────────────────────────────────
  // On first load, if a token exists verify it's still valid
  // by fetching /auth/me. This handles page refreshes.
  useEffect(() => {
    const token = localStorage.getItem('tt_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then(({ data }) => setUser(data.data.user))
      .catch(() => {
        // Token invalid or expired — clear it silently
        localStorage.removeItem('tt_token');
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Login ─────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('tt_token', data.token);
    setUser(data.data.user);
    return data.data.user; // caller can redirect based on role
  }, []);

  // ── Register ──────────────────────────────────────────────────
  // Returns { status: 'pending', email } — the caller must show the OTP step.
  // No JWT is issued until email is verified.
  const register = useCallback(async (formData) => {
    const { data } = await api.post('/auth/register', formData);
    // data.status === 'pending' — no token yet
    return data; // { status, message, data: { email } }
  }, []);

  // ── Verify Email (OTP) ────────────────────────────────────────
  // On success the server returns a full auth response (token + user).
  const verifyEmail = useCallback(async (email, otp) => {
    const { data } = await api.post('/auth/verify-email', { email, otp });
    localStorage.setItem('tt_token', data.token);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  // ── Resend OTP ────────────────────────────────────────────────
  const resendOtp = useCallback(async (email) => {
    const { data } = await api.post('/auth/resend-otp', { email });
    return data;
  }, []);

  // ── Logout ────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if server call fails, clear local state
    } finally {
      localStorage.removeItem('tt_token');
      setUser(null);
    }
  }, []);

  // ── Patch local user (after profile update, wallet deposit, etc.) ─
  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // ── Refresh from server (after wallet changes etc.) ───────────
  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.data.user);
    return data.data.user;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, verifyEmail, resendOtp, logout, updateUser, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
