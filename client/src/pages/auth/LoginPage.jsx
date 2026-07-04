import { Mail } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import LogoIcon from '../../components/brand/LogoIcon';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [form, setForm]         = useState({ email: '', password: '' });
  const [error, setError]       = useState('');
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Email and password are required.'); return; }
    setLoading(true); setError(''); setUnverified(false);
    try {
      const user = await login(form.email, form.password);
      const roleHome = { buyer: '/', seller: '/seller/products', admin: '/admin/dashboard' };
      navigate(from || roleHome[user.role] || '/', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid email or password.';
      if (msg.toLowerCase().includes('not verified') || msg.toLowerCase().includes('verify your email')) {
        setUnverified(true);
      }
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-6 group">
            <LogoIcon size="lg" />
            <div className="flex flex-col items-start leading-none">
              <span className="font-extrabold text-2xl tracking-tight text-white">TrustTrade</span>
              <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-amber-400/80">Bangladesh</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-zinc-500 mt-1 text-sm">Sign in to continue trading safely</p>
        </div>

        {/* Card */}
        <div className="card-glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email address</label>
              <input type="email" className="input" placeholder="you@example.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                autoComplete="email" autoFocus />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-zinc-300">Password</label>
                <Link to="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Forgot password?</Link>
              </div>
              <input type="password" className="input" placeholder="••••••••"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="current-password" />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className={`border rounded-xl px-4 py-3 text-sm ${
                  unverified
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}>
                {unverified ? (
                  <span>
                    <Mail className="inline w-5 h-5 mr-1 align-text-bottom" /> Your email isn't verified yet.{' '}
                    <Link to="/register" className="underline underline-offset-2 font-medium hover:text-amber-300 transition-colors">
                      Complete verification
                    </Link>
                  </span>
                ) : error}
              </motion.div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-violet-400 font-medium hover:text-violet-300 transition-colors">
              Create one free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
