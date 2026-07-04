import LogoIcon from '../../components/brand/LogoIcon';
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../context/AuthContext';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ 
    email: location.state?.email || '', 
    otp: '', 
    newPassword: '', 
    confirmPassword: '' 
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!form.email || !form.otp) {
      setError('Email and reset code are required.');
      return;
    }
    
    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.newPassword)) {
      setError('Password must contain uppercase, lowercase, and a number.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setSuccess('');
    
    try {
      const { data } = await api.post(`/auth/reset-password`, { 
        email: form.email, 
        otp: form.otp, 
        newPassword: form.newPassword 
      });
      setSuccess(data.message);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired reset code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-4 group">
            <LogoIcon size="lg" />
            <div className="flex flex-col items-start leading-none">
              <span className="font-extrabold text-xl tracking-tight text-white">TrustTrade</span>
              <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-amber-400/80">Bangladesh</span>
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Choose New Password</h1>
          <p className="text-zinc-400">Enter your 6-digit code and new password.</p>
        </div>

        <div className="card p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 to-emerald-400" />
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email address</label>
              <input 
                type="email" 
                value={form.email} 
                onChange={e => setForm({ ...form, email: e.target.value })}
                className={`input ${error ? 'border-rose-500/50 focus:ring-rose-500/20' : ''}`}
                placeholder="you@example.com"
                readOnly={!!location.state?.email}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">6-Digit Reset Code</label>
              <input 
                type="text" 
                value={form.otp} 
                onChange={e => setForm({ ...form, otp: e.target.value })}
                className={`input font-mono tracking-widest ${error ? 'border-rose-500/50 focus:ring-rose-500/20' : ''}`}
                placeholder="123456"
                maxLength="6"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">New password</label>
              <input 
                type="password" 
                value={form.newPassword} 
                onChange={e => setForm({ ...form, newPassword: e.target.value })}
                className={`input ${error ? 'border-rose-500/50 focus:ring-rose-500/20' : ''}`}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Confirm new password</label>
              <input 
                type="password" 
                value={form.confirmPassword} 
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                className={`input ${error ? 'border-rose-500/50 focus:ring-rose-500/20' : ''}`}
                placeholder="••••••••"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Resetting...
                </span>
              ) : 'Reset password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
