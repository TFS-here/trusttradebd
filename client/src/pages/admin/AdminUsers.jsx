import { Check } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../../api/adminApi';

const ReasonModal = ({ title, placeholder, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handle = async () => {
    if (!reason.trim()) { setError('Reason is required.'); return; }
    setLoading(true); setError('');
    try { await onConfirm(reason.trim()); }
    catch (err) { setError(err.response?.data?.message || 'Action failed.'); }
    finally { setLoading(false); }
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}>
      <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="card-glass rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
        <h3 className="font-bold text-zinc-100">{title}</h3>
        <textarea autoFocus value={reason} onChange={e => setReason(e.target.value)}
          placeholder={placeholder} rows={3} className="input resize-none" />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 btn-secondary text-sm py-2.5">Cancel</button>
          <button onClick={handle} disabled={loading} className="flex-1 btn-danger text-sm py-2.5">
            {loading ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const RoleBadge = ({ role }) => {
  const styles = {
    buyer:  'badge-violet',
    seller: 'bg-emerald-400/15 text-emerald-400 border border-emerald-400/20 badge',
    admin:  'bg-zinc-100/10 text-zinc-200 border border-white/20 badge',
  };
  return <span className={`${styles[role] || 'badge-zinc'} text-xs font-semibold px-2.5 py-1 rounded-full capitalize`}>{role}</span>;
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ page: 1, limit: 20, role: '', isBlocked: '', search: '' });
  const [modal, setModal] = useState(null);
  const [feedback, setFeedback] = useState({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const { data } = await adminApi.getUsers(params);
      setUsers(data.data.users); setPagination(data.data.pagination);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const showFeedback = (id, msg) => {
    setFeedback(p => ({ ...p, [id]: msg }));
    setTimeout(() => setFeedback(p => ({ ...p, [id]: null })), 3000);
  };

  const handleBlock = async (userId, reason) => {
    await adminApi.blockUser(userId, reason);
    setUsers(p => p.map(u => u._id === userId ? { ...u, isBlocked: true, blockedReason: reason } : u));
    setModal(null); showFeedback(userId, 'Blocked');
  };

  const handleUnblock = async (userId) => {
    await adminApi.unblockUser(userId);
    setUsers(p => p.map(u => u._id === userId ? { ...u, isBlocked: false, blockedReason: '' } : u));
    showFeedback(userId, 'Unblocked');
  };

  const handleRoleChange = async (userId, role) => {
    await adminApi.changeRole(userId, role);
    setUsers(p => p.map(u => u._id === userId ? { ...u, role } : u));
    showFeedback(userId, `Role → ${role}`);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      <div>
        <p className="section-label mb-1">Management</p>
        <h1 className="text-2xl font-bold text-zinc-100">Users</h1>
        {pagination && <p className="text-sm text-zinc-600 mt-0.5">{pagination.total} total accounts</p>}
      </div>

      {/* Filters */}
      <div className="card rounded-2xl p-4 flex flex-col sm:flex-row flex-wrap gap-3">
        <input placeholder="Search name or email…" value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
          className="input flex-1 min-w-0 sm:min-w-[200px]" />
        <div className="flex gap-3">
          <select value={filters.role} onChange={e => setFilters(f => ({ ...f, role: e.target.value, page: 1 }))}
            className="flex-1 bg-surface-3 border border-white/8 text-zinc-400 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500/40">
            <option value="">All roles</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
          </select>
          <select value={filters.isBlocked} onChange={e => setFilters(f => ({ ...f, isBlocked: e.target.value, page: 1 }))}
            className="flex-1 bg-surface-3 border border-white/8 text-zinc-400 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500/40">
            <option value="">All status</option>
            <option value="false">Active</option>
            <option value="true">Blocked</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-surface-2 rounded-xl" />)}
          </div>
        ) : users.length === 0 ? (
          <p className="text-center py-12 text-zinc-600 text-sm">No users found.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {users.map(user => (
              <motion.div key={user._id} layout
                className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-white/3 transition ${user.isBlocked ? 'opacity-50' : ''}`}>
                {/* Avatar + info row */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7C3AED&color=fff&size=40`}
                    alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-violet-500/20 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/admin/users/${user._id}`}
                        className="font-semibold text-sm text-zinc-200 hover:text-violet-400 transition truncate">
                        {user.name}
                      </Link>
                      <RoleBadge role={user.role} />
                      {user.isBlocked && <span className="badge-rose text-xs px-2 py-0.5 rounded-full">Blocked</span>}
                    </div>
                    <p className="text-xs text-zinc-600 truncate">{user.email}</p>
                    {user.isBlocked && user.blockedReason && (
                      <p className="text-xs text-rose-400/70 truncate mt-0.5">Reason: {user.blockedReason}</p>
                    )}
                  </div>
                </div>
                {/* Wallet + actions row */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-13 sm:pl-0">
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-sm font-semibold text-zinc-200">৳{user.wallet?.balance?.toLocaleString('en-BD') || '0'}</p>
                    <p className="text-xs text-zinc-600">wallet</p>
                  </div>
                  <AnimatePresence>
                    {feedback[user._id] && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-xs text-emerald-400 font-medium shrink-0"><Check className="inline w-5 h-5 mr-1 align-text-bottom" /> {feedback[user._id]}</motion.span>
                    )}
                  </AnimatePresence>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {user.role !== 'admin' && (
                      <select value={user.role} onChange={e => handleRoleChange(user._id, e.target.value)}
                        className="text-xs bg-surface-3 border border-white/8 text-zinc-400 rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer hover:border-violet-500/30 transition">
                        <option value="buyer">Buyer</option>
                        <option value="seller">Seller</option>
                      </select>
                    )}
                    {user.isBlocked ? (
                      <button onClick={() => handleUnblock(user._id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20 transition font-medium">
                        Unblock
                      </button>
                    ) : (
                      <button onClick={() => setModal({ type: 'block', userId: user._id, userEmail: user.email })}
                        className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition font-medium">
                        Block
                      </button>
                    )}
                    {user.role === 'seller' && (
                      <Link to={`/admin/users/${user._id}/products`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-surface-2 border border-white/8 text-zinc-400 hover:border-violet-500/30 hover:text-violet-400 transition font-medium">
                        Products
                      </Link>
                    )}
                    <Link to={`/admin/users/${user._id}`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-surface-2 border border-white/8 text-zinc-400 hover:border-violet-500/30 hover:text-violet-400 transition font-medium">
                      View
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex justify-center gap-2 px-5 py-4 border-t border-white/5">
            <button onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
              disabled={!pagination.hasPrev}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-30">← Prev</button>
            <span className="px-3 py-1.5 text-sm text-zinc-600">{pagination.page} / {pagination.pages}</span>
            <button onClick={() => setFilters(f => ({ ...f, page: Math.min(pagination.pages, f.page + 1) }))}
              disabled={!pagination.hasNext}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-30">Next →</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modal?.type === 'block' && (
          <ReasonModal title={`Block ${modal.userEmail}?`}
            placeholder="State the reason for blocking this account…"
            onConfirm={reason => handleBlock(modal.userId, reason)}
            onCancel={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUsers;
