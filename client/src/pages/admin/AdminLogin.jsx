import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminApi } from '../../api/adminApi';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Email and password are required.'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await adminApi.login(form);
      localStorage.setItem('tt_admin_token', data.token);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-3xl" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4 relative">
            <div className="absolute inset-0 bg-violet-500/20 rounded-2xl blur-md" />
            <div className="relative w-12 h-12 bg-surface-2 border border-violet-500/30 rounded-2xl flex items-center justify-center">
              <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
          </div>
          <p className="text-zinc-100 font-semibold">Secure Access</p>
          <p className="text-xs text-zinc-600 mt-1">TrustTrade BD Admin</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="Admin email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            autoComplete="email"
            className="input" autoFocus />
          <input type="password" placeholder="Password" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            autoComplete="current-password"
            className="input" />

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-rose-400 text-sm text-center bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
              {error}
            </motion.p>
          )}

          <button type="submit" disabled={loading}
            className="w-full btn-primary py-3">
            {loading ? 'Verifying…' : 'Continue'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
