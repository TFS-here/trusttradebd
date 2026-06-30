import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

// ── Lifted outside to prevent focus loss ─────────────────────────
const RoleCard = ({ value, selectedRole, onSelect, title, description, icon }) => (
  <motion.button type="button" whileTap={{ scale: 0.98 }}
    onClick={() => onSelect(value)}
    className={`w-full text-left p-5 rounded-2xl border transition-all duration-200
                ${selectedRole === value
                  ? 'border-violet-500/60 bg-violet-500/10 shadow-glow-violet/30'
                  : 'border-white/8 bg-white/3 hover:border-violet-500/30 hover:bg-violet-500/5'}`}>
    <div className="text-3xl mb-3">{icon}</div>
    <h3 className="font-bold text-zinc-100">{title}</h3>
    <p className="text-sm text-zinc-500 mt-1">{description}</p>
  </motion.button>
);

const Field = ({ label, name, type = 'text', placeholder, optional, form, errors, setForm }) => (
  <div>
    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
      {label}{optional && <span className="text-zinc-600 font-normal ml-1">(optional)</span>}
    </label>
    {type === 'textarea' ? (
      <textarea rows={3} placeholder={placeholder} value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        className={`input resize-none ${errors[name] ? 'border-rose-500/50 focus:ring-rose-500/20' : ''}`} />
    ) : (
      <input type={type} placeholder={placeholder} value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        autoComplete={name === 'email' ? 'email' : name === 'password' ? 'new-password' : 'off'}
        className={`input ${errors[name] ? 'border-rose-500/50 focus:ring-rose-500/20' : ''}`} />
    )}
    {errors[name] && <p className="text-xs text-rose-400 mt-1">{errors[name]}</p>}
  </div>
);

// ── OTP Input Component ───────────────────────────────────────────
const OtpInput = ({ value, onChange, disabled }) => {
  const inputRefs = useRef([]);
  const digits = value.split('');

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[idx]) {
        const next = [...digits];
        next[idx] = '';
        onChange(next.join(''));
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
        const next = [...digits];
        next[idx - 1] = '';
        onChange(next.join(''));
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleChange = (e, idx) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...Array(6)].map((_, i) => digits[i] || '');
    next[idx] = val;
    onChange(next.join(''));
    if (val && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted.padEnd(6, '').slice(0, 6));
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center">
      {[...Array(6)].map((_, idx) => (
        <motion.input
          key={idx}
          ref={el => (inputRefs.current[idx] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[idx] || ''}
          disabled={disabled}
          onChange={e => handleChange(e, idx)}
          onKeyDown={e => handleKeyDown(e, idx)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          whileFocus={{ scale: 1.05 }}
          className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border transition-all duration-150 outline-none
            bg-white/5 text-white caret-violet-400
            ${digits[idx]
              ? 'border-violet-500/70 bg-violet-500/10 shadow-[0_0_12px_rgba(139,92,246,0.25)]'
              : 'border-white/12 hover:border-white/20 focus:border-violet-500/60 focus:bg-violet-500/5'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────
const RegisterPage = () => {
  const { register, verifyEmail, resendOtp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', shopName: '', shopDescription: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Step 3 — OTP state
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters.';
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email is required.';
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) e.password = 'Must contain uppercase, lowercase, and a number.';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    if (role === 'seller' && !form.shopName.trim()) e.shopName = 'Shop name is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); setApiError('');
    try {
      const res = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
        ...(role === 'seller' && { shopName: form.shopName.trim(), shopDescription: form.shopDescription.trim() }),
      });
      // status === 'pending' — go to OTP step
      setPendingEmail(res.data.email);
      setResendCooldown(60);
      setStep(3);
    } catch (err) {
      setApiError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length < 6) { setOtpError('Please enter the full 6-digit code.'); return; }
    setVerifying(true); setOtpError(''); setOtpSuccess('');
    try {
      const user = await verifyEmail(pendingEmail, otp);
      setOtpSuccess('Email verified! Redirecting…');
      setTimeout(() => {
        navigate(user.role === 'seller' ? '/seller/products' : '/', { replace: true });
      }, 800);
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid code. Please try again.');
      setOtp('');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;
    setOtpError(''); setOtpSuccess('');
    try {
      await resendOtp(pendingEmail);
      setOtpSuccess('New code sent! Check your email.');
      setResendCooldown(60);
      setOtp('');
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Could not resend. Please try again.');
    }
  }, [resendCooldown, pendingEmail, resendOtp]);

  const fp = { form, errors, setForm };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-emerald-500/6 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }} className="w-full max-w-md relative z-10">

        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 bg-violet-500 rounded-xl blur-md opacity-60" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
            </div>
            <span className="font-bold text-xl text-white">TrustTrade<span className="text-gradient-violet"> BD</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-zinc-500 mt-1 text-sm">Trade safely with escrow protection</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 justify-center mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <motion.div
                animate={{
                  background: step >= s ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'rgba(255,255,255,0.06)',
                  scale: step === s ? 1.15 : 1,
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
              >
                {step > s ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : s}
              </motion.div>
              {s < 3 && <div className={`w-8 h-0.5 rounded-full transition-all duration-500 ${step > s ? 'bg-violet-500' : 'bg-white/8'}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step 1: Choose Role ────────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} className="card-glass rounded-2xl p-6 space-y-4">
              <p className="text-sm font-medium text-zinc-400 text-center">I want to…</p>
              <RoleCard value="buyer" selectedRole={role} onSelect={v => { setRole(v); setStep(2); }}
                title="Shop as a Buyer" icon="🛍️"
                description="Browse products, order securely, and pay only when you receive your items." />
              <RoleCard value="seller" selectedRole={role} onSelect={v => { setRole(v); setStep(2); }}
                title="Sell as a Seller" icon="🏪"
                description="List products, manage orders, and get paid safely through escrow." />
              <p className="text-center text-sm text-zinc-600 pt-2">
                Already have an account?{' '}
                <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">Sign in</Link>
              </p>
            </motion.div>
          )}

          {/* ── Step 2: Registration Form ──────────────────────────────── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} className="card-glass rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setStep(1)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm text-zinc-500">
                  Signing up as a <span className="font-semibold text-violet-400 capitalize">{role}</span>
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Full name" name="name" placeholder="Rahim Uddin" {...fp} />
                <Field label="Email" name="email" type="email" placeholder="rahim@example.com" {...fp} />
                <Field label="Password" name="password" type="password" placeholder="Min. 8 characters" {...fp} />
                <Field label="Confirm password" name="confirmPassword" type="password" placeholder="Repeat password" {...fp} />

                {role === 'seller' && (
                  <>
                    <div className="glow-divider my-2" />
                    <p className="text-xs font-bold uppercase tracking-widest text-violet-400">Shop details</p>
                    <Field label="Shop name" name="shopName" placeholder="Rahim's Electronics" {...fp} />
                    <Field label="Shop description" name="shopDescription" type="textarea" placeholder="What do you sell?" optional {...fp} />
                  </>
                )}

                {apiError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 text-sm">
                    {apiError}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Creating account…
                    </span>
                  ) : 'Create account'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-zinc-600">
                Already have an account?{' '}
                <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">Sign in</Link>
              </p>
            </motion.div>
          )}

          {/* ── Step 3: Email Verification OTP ────────────────────────── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }} className="card-glass rounded-2xl p-8">

              {/* Icon */}
              <div className="flex justify-center mb-6">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-16 h-16 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-3xl shadow-[0_0_24px_rgba(139,92,246,0.2)]"
                >
                  📧
                </motion.div>
              </div>

              <h2 className="text-xl font-bold text-white text-center mb-1">Check your email</h2>
              <p className="text-sm text-zinc-500 text-center mb-6">
                We sent a 6-digit code to{' '}
                <span className="text-violet-400 font-medium break-all">{pendingEmail}</span>
              </p>

              <form onSubmit={handleVerify} className="space-y-6">
                {/* OTP digit boxes */}
                <div>
                  <OtpInput value={otp} onChange={setOtp} disabled={verifying || !!otpSuccess} />
                  <p className="text-xs text-zinc-600 text-center mt-3">Expires in 10 minutes · Check spam if not received</p>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {otpError && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 text-sm">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                      </svg>
                      {otpError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Success */}
                <AnimatePresence>
                  {otpSuccess && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl px-4 py-3 text-sm">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      {otpSuccess}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Verify Button */}
                <button type="submit"
                  disabled={verifying || otp.length < 6 || !!otpSuccess}
                  className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed">
                  {verifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Verifying…
                    </span>
                  ) : '✓ Verify email'}
                </button>
              </form>

              {/* Resend */}
              <div className="mt-5 text-center">
                <p className="text-sm text-zinc-600">
                  Didn't receive it?{' '}
                  <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className={`font-medium transition-colors ${
                      resendCooldown > 0
                        ? 'text-zinc-600 cursor-not-allowed'
                        : 'text-violet-400 hover:text-violet-300 cursor-pointer'
                    }`}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </p>
              </div>

              {/* Back link */}
              <div className="mt-4 text-center">
                <button onClick={() => { setStep(2); setOtp(''); setOtpError(''); setOtpSuccess(''); }}
                  className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors">
                  ← Back to registration
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
