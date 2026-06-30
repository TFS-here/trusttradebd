import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../context/AuthContext';

// Lifted outside to prevent focus loss
const Field = ({ label, name, type = 'text', placeholder, value, onChange, error, hint }) => (
  <div>
    <label className="block text-sm font-medium text-zinc-400 mb-1.5">{label}</label>
    <input type={type} placeholder={placeholder} value={value}
      onChange={e => onChange(name, e.target.value)}
      className={`input ${error ? 'border-rose-500/50 focus:ring-rose-500/20' : ''}`} />
    {hint  && !error && <p className="text-xs text-zinc-600 mt-1">{hint}</p>}
    {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
  </div>
);

const ProfilePage = () => {
  const { user, updateUser } = useAuth();

  const [profileForm, setProfileForm] = useState({
    name:            user?.name || '',
    phone:           user?.phone || '',
    shopName:        user?.sellerProfile?.shopName || '',
    shopDescription: user?.sellerProfile?.shopDescription || '',
  });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileErrors, setProfileErrors] = useState({});
  const [pwErrors, setPwErrors]           = useState({});
  const [profileLoading, setProfileLoad]  = useState(false);
  const [pwLoading, setPwLoad]            = useState(false);
  const [profileSuccess, setProfileSuc]   = useState('');
  const [pwSuccess, setPwSuc]             = useState('');
  const [profileError, setProfileErr]     = useState('');
  const [pwError, setPwErr]               = useState('');

  const setProfile = (key, val) => setProfileForm(f => ({ ...f, [key]: val }));
  const setPw      = (key, val) => setPwForm(f => ({ ...f, [key]: val }));

  const handleProfileSave = async e => {
    e.preventDefault();
    const errs = {};
    if (!profileForm.name.trim() || profileForm.name.trim().length < 2)
      errs.name = 'Name must be at least 2 characters.';
    setProfileErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setProfileLoad(true); setProfileErr(''); setProfileSuc('');
    try {
      const payload = { name: profileForm.name.trim(), phone: profileForm.phone.trim() };
      if (user?.role === 'seller') {
        payload.shopName        = profileForm.shopName.trim();
        payload.shopDescription = profileForm.shopDescription.trim();
      }
      const { data } = await api.put('/auth/update-profile', payload);
      updateUser(data.data.user);
      setProfileSuc('Profile updated successfully!');
      setTimeout(() => setProfileSuc(''), 3000);
    } catch (err) { setProfileErr(err.response?.data?.message || 'Update failed.'); }
    finally { setProfileLoad(false); }
  };

  const handlePwSave = async e => {
    e.preventDefault();
    const errs = {};
    if (!pwForm.currentPassword)          errs.currentPassword = 'Current password is required.';
    if (!pwForm.newPassword || pwForm.newPassword.length < 8)
      errs.newPassword = 'Password must be at least 8 characters.';
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pwForm.newPassword))
      errs.newPassword = 'Must contain uppercase, lowercase, and a number.';
    if (pwForm.newPassword !== pwForm.confirmPassword)
      errs.confirmPassword = 'Passwords do not match.';
    setPwErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPwLoad(true); setPwErr(''); setPwSuc('');
    try {
      await api.put('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword:     pwForm.newPassword,
      });
      setPwSuc('Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPwSuc(''), 3000);
    } catch (err) { setPwErr(err.response?.data?.message || 'Password change failed.'); }
    finally { setPwLoad(false); }
  };

  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.status === 'success') {
        const res = await api.put('/auth/update-profile', { avatar: data.data.url });
        updateUser(res.data.data.user);
      }
    } catch (err) {
      console.error(err);
      alert('Avatar upload failed');
    } finally {
      setAvatarUploading(false);
    }
  };

  const roleLabel = { buyer: 'Buyer', seller: 'Seller', admin: 'Admin' };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="section-label mb-1">Account</p>
        <h1 className="text-2xl font-bold text-zinc-100">My Profile</h1>
      </div>

      {/* Avatar + role card */}
      <div className="card rounded-2xl p-6 flex items-center gap-5">
        <div className="relative shrink-0 group">
          <div className="absolute inset-0 bg-violet-500/30 rounded-full blur-md" />
          <img
            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name||'U')}&background=7C3AED&color=fff&size=80`}
            alt={user?.name}
            className={`relative w-20 h-20 rounded-full object-cover ring-2 ring-violet-500/40 transition-opacity ${avatarUploading ? 'opacity-50' : ''}`}
          />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-surface-1" />
          
          <label className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity z-10 text-xs font-medium">
            {avatarUploading ? '...' : 'Upload'}
            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={avatarUploading} />
          </label>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-zinc-100 truncate">{user?.name}</p>
          <p className="text-sm text-zinc-600 truncate">{user?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="badge-violet capitalize">{roleLabel[user?.role] || user?.role}</span>
            {user?.wallet && (
              <span className="badge-emerald">
                ৳{(user.wallet.availableBalance ?? user.wallet.balance ?? 0).toLocaleString('en-BD')} available
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Profile form */}
      <div className="card rounded-2xl p-6">
        <p className="section-label mb-5">Personal Information</p>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <Field label="Full name" name="name" placeholder="Rahim Uddin"
            value={profileForm.name} onChange={setProfile} error={profileErrors.name} />
          <Field label="Phone" name="phone" placeholder="01XXXXXXXXX"
            value={profileForm.phone} onChange={setProfile} error={profileErrors.phone} />

          {user?.role === 'seller' && (
            <>
              <div className="glow-divider" />
              <p className="section-label">Shop Details</p>
              <Field label="Shop name" name="shopName" placeholder="Rahim's Electronics"
                value={profileForm.shopName} onChange={setProfile} error={profileErrors.shopName} />
              <Field label="Shop description" name="shopDescription" placeholder="What do you sell?"
                value={profileForm.shopDescription} onChange={setProfile} />
            </>
          )}

          <AnimatePresence>
            {profileSuccess && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 rounded-xl px-4 py-3 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {profileSuccess}
              </motion.div>
            )}
            {profileError && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 text-sm">
                {profileError}
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={profileLoading} className="btn-primary w-full py-2.5">
            {profileLoading ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Password form */}
      <div className="card rounded-2xl p-6">
        <p className="section-label mb-5">Change Password</p>
        <form onSubmit={handlePwSave} className="space-y-4">
          <Field label="Current password" name="currentPassword" type="password" placeholder="••••••••"
            value={pwForm.currentPassword} onChange={setPw} error={pwErrors.currentPassword} />
          <Field label="New password" name="newPassword" type="password" placeholder="Min. 8 characters"
            value={pwForm.newPassword} onChange={setPw} error={pwErrors.newPassword}
            hint="Must contain uppercase, lowercase, and a number." />
          <Field label="Confirm new password" name="confirmPassword" type="password" placeholder="Repeat password"
            value={pwForm.confirmPassword} onChange={setPw} error={pwErrors.confirmPassword} />

          <AnimatePresence>
            {pwSuccess && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 rounded-xl px-4 py-3 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {pwSuccess}
              </motion.div>
            )}
            {pwError && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 text-sm">
                {pwError}
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={pwLoading} className="btn-secondary w-full py-2.5">
            {pwLoading ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
