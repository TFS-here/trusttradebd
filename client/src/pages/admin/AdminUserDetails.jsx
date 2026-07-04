import { Star } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { motion } from 'framer-motion';

const RoleBadge = ({ role }) => {
  const styles = {
    buyer:  'badge-violet',
    seller: 'bg-emerald-400/15 text-emerald-400 border border-emerald-400/20 badge',
    admin:  'bg-zinc-100/10 text-zinc-200 border border-white/20 badge',
  };
  return <span className={`${styles[role] || 'badge-zinc'} text-xs font-semibold px-2.5 py-1 rounded-full capitalize`}>{role}</span>;
};

const AdminUserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUser(id);
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load user details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-surface-2 rounded-xl" />
        <div className="h-64 bg-surface-2 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-20">
        <p className="text-rose-400 mb-4">{error}</p>
        <button onClick={() => navigate('/admin/users')} className="btn-secondary text-sm">
          ← Back to Users
        </button>
      </div>
    );
  }

  const { user, orders, txSummary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/admin/users')} className="text-sm text-zinc-400 hover:text-white transition mb-2">
            ← Back to Users
          </button>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            User Profile
            <RoleBadge role={user.role} />
            {user.isBlocked && <span className="badge-rose text-xs px-2 py-0.5 rounded-full">Blocked</span>}
          </h1>
        </div>
        {user.role === 'seller' && (
          <Link to={`/admin/users/${user._id}/products`} className="btn-primary text-sm px-4 py-2">
            View Seller Products →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Profile & Wallet */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card rounded-2xl p-6 flex flex-col items-center text-center">
            <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7C3AED&color=fff&size=80`}
                 alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-violet-500/20 mb-4" />
            <h2 className="text-lg font-bold text-zinc-100">{user.name}</h2>
            <p className="text-sm text-zinc-400 mb-4">{user.email}</p>
            <div className="w-full text-left bg-surface-3 p-4 rounded-xl space-y-2 text-sm text-zinc-300">
              <p><span className="text-zinc-500">Joined:</span> {new Date(user.createdAt).toLocaleDateString()}</p>
              <p><span className="text-zinc-500">ID:</span> {user._id}</p>
              {user.isBlocked && user.blockedReason && (
                <p className="text-rose-400"><span className="font-semibold">Block Reason:</span> {user.blockedReason}</p>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-zinc-100 mb-4 uppercase tracking-wider">Wallet Summary</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500">Available Balance</p>
                <p className="text-2xl font-bold text-emerald-400">৳{user.wallet?.balance?.toLocaleString('en-BD') || '0'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Escrow Balance</p>
                <p className="text-lg font-semibold text-amber-400">৳{user.wallet?.escrowBalance?.toLocaleString('en-BD') || '0'}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Seller Info & Recent Orders */}
        <div className="md:col-span-2 space-y-6">
          {user.role === 'seller' && user.sellerProfile && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-zinc-100 mb-4 uppercase tracking-wider">Seller Dashboard</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-surface-3 p-4 rounded-xl">
                  <p className="text-xs text-zinc-500">Shop Name</p>
                  <p className="text-sm font-semibold text-zinc-200 mt-1 truncate">{user.sellerProfile.shopName || user.name}</p>
                </div>
                <div className="bg-surface-3 p-4 rounded-xl">
                  <p className="text-xs text-zinc-500">Total Sales</p>
                  <p className="text-sm font-semibold text-zinc-200 mt-1">{user.sellerProfile.totalSales || 0}</p>
                </div>
                <div className="bg-surface-3 p-4 rounded-xl">
                  <p className="text-xs text-zinc-500">Rating</p>
                  <p className="text-sm font-semibold text-amber-400 mt-1"><Star className="inline w-5 h-5 mr-1 align-text-bottom" /> {(user.sellerProfile.rating || 0).toFixed(1)}</p>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-zinc-100 mb-4 uppercase tracking-wider">Recent Orders</h3>
            {orders.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">No orders found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-zinc-500 border-b border-white/5">
                      <th className="pb-3 font-medium">Order ID</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium text-right">Amount</th>
                      <th className="pb-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orders.map(order => (
                      <tr key={order._id} className="text-zinc-300">
                        <td className="py-3">
                          <Link to={`/admin/orders?search=${order._id}`} className="font-mono text-xs text-violet-400 hover:underline">
                            {order._id.slice(-8)}
                          </Link>
                        </td>
                        <td className="py-3">{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 text-right font-medium">৳{order.totalAmount}</td>
                        <td className="py-3 text-right">
                          <span className="text-xs font-semibold px-2 py-1 rounded bg-surface-3">{order.escrowStatus}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-zinc-100 mb-4 uppercase tracking-wider">Transaction Summary</h3>
            {txSummary.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">No transactions found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {txSummary.map(tx => (
                  <div key={tx._id} className="bg-surface-3 p-4 rounded-xl">
                    <p className="text-xs text-zinc-500">{tx._id}</p>
                    <p className="text-sm font-semibold text-zinc-200 mt-1">৳{tx.total.toLocaleString('en-BD')}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">{tx.count} record(s)</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserDetails;
