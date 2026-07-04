import LogoIcon from '../../components/brand/LogoIcon';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../context/AuthContext';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Email is required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setSuccess(data.message);
      setTimeout(() => navigate('/reset-password', { state: { email } }), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Try again.');
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
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Reset Password</h1>
          <p className="text-zinc-400">Enter your email and we'll send you a reset link.</p>
        </div>

        <div className="card p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email address</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                className={`input ${error ? 'border-rose-500/50 focus:ring-rose-500/20' : ''}`}
                placeholder="you@example.com"
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

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </span>
              ) : 'Send reset link'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            Remember your password?{' '}
            <Link to="/login" className="text-violet-400 font-medium hover:text-violet-300 transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
