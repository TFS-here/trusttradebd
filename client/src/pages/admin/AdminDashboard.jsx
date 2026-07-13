import { Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminApi } from '../../api/adminApi';

const ESCROW_STYLES = {
  LOCKED:    'badge-amber',
  SHIPPED:   'badge-violet',
  DELIVERED: 'badge-violet',
  RELEASED:  'badge-emerald',
  ON_HOLD:   'badge-rose',
  REFUNDED:  'badge-zinc',
};

const StatCard = ({ label, value, sub, color = 'violet', index = 0 }) => {
  const colors = {
    violet:  { ring: 'border-violet-500/20',  glow: 'bg-violet-500/5',   text: 'text-violet-400'  },
    emerald: { ring: 'border-emerald-400/20', glow: 'bg-emerald-400/5',  text: 'text-emerald-400' },
    amber:   { ring: 'border-amber-400/20',   glow: 'bg-amber-400/5',    text: 'text-amber-400'   },
    rose:    { ring: 'border-rose-500/20',    glow: 'bg-rose-500/5',     text: 'text-rose-400'    },
  };
  const c = colors[color] || colors.violet;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`card rounded-2xl p-5 border ${c.ring} ${c.glow} relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-30 pointer-events-none"
           style={{ background: color === 'violet' ? 'rgba(139,92,246,0.3)' : color === 'emerald' ? 'rgba(52,211,153,0.3)' : color === 'amber' ? 'rgba(251,191,36,0.3)' : 'rgba(251,113,133,0.3)' }} />
      <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${c.text}`}>{label}</p>
      <p className="text-3xl font-extrabold text-zinc-100 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </motion.div>
  );
};

const AdminDashboard = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    adminApi.getDashboard()
      .then(({ data }) => setData(data.data))
      .catch(() => setError('Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-4 sm:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {[...Array(7)].map((_, i) => <div key={i} className="h-28 bg-surface-2 rounded-2xl" />)}
    </div>
  );

  if (error) return <div className="p-8 text-rose-400">{error}</div>;

  const { overview, escrowBreakdown, recentOrders, topSellers } = data;

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="section-label mb-1">Overview</p>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-600 mt-0.5">
            {new Date().toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/users"  className="btn-secondary text-sm">Users</Link>
          <Link to="/admin/orders" className="btn-primary text-sm">Orders</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users"    index={0} color="violet"  value={overview.totalUsers.toLocaleString()} sub={`+${overview.newUsersThisMonth} this month`} />
        <StatCard label="Total Orders"   index={1} color="violet"  value={overview.totalOrders.toLocaleString()} sub={`${overview.ordersThisMonth} this month`} />
        <StatCard label="Platform GMV"   index={2} color="emerald" value={`৳${overview.gmv.toLocaleString('en-BD')}`} sub="All time" />
        <StatCard label="Revenue"        index={3} color="emerald" value={`৳${overview.platformRevenue.toLocaleString('en-BD')}`} sub={overview.revenueChange != null ? `${overview.revenueChange >= 0 ? '+' : ''}${overview.revenueChange}% vs last month` : 'This month'} />
        <StatCard label="Active Products" index={4} color="violet"  value={overview.activeProducts.toLocaleString()} sub={`${overview.totalProducts} total`} />
        <StatCard label="Blocked Users"  index={5} color="rose"    value={overview.blockedUsers.toLocaleString()} sub="Suspended accounts" />
        <StatCard label="Disputes"       index={6} color="amber"   value={overview.disputedOrders.toLocaleString()} sub="Orders on hold" />
      </div>

      {/* Escrow breakdown */}
      <div className="card rounded-2xl p-6">
        <p className="section-label mb-4">Escrow Breakdown</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(escrowBreakdown).map(([status, count]) => (
            <div key={status} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${ESCROW_STYLES[status] || 'badge-zinc'}`}>
              <span className="font-bold text-lg">{count}</span>
              <span className="opacity-70">{status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="font-semibold text-zinc-200">Recent Orders</p>
            <Link to="/admin/orders" className="text-xs text-violet-400 hover:text-violet-300 transition">View all →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {recentOrders.map(order => (
              <Link key={order._id} to={`/admin/orders`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200 font-mono">#{order._id.slice(-6).toUpperCase()}</p>
                  {order.items?.length > 0 && (
                    <p className="text-sm text-zinc-300 mt-0.5 truncate">
                      {order.items.map(i => i.title).join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-zinc-600 truncate mt-0.5">
                    {order.buyer?.name} → {order.seller?.sellerProfile?.shopName || order.seller?.name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-zinc-100">৳{order.totalAmount.toLocaleString('en-BD')}</p>
                  <span className={`text-xs ${ESCROW_STYLES[order.escrowStatus] || 'badge-zinc'} px-2 py-0.5 rounded-full`}>
                    {order.escrowStatus}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top sellers */}
        <div className="card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="font-semibold text-zinc-200">Top Sellers</p>
          </div>
          <div className="divide-y divide-white/5">
            {topSellers.map((seller, i) => (
              <Link key={seller._id} to={`/admin/users/${seller._id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition">
                <span className="text-sm font-bold text-zinc-700 w-5 shrink-0">{i + 1}</span>
                <img src={seller.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.name)}&background=7C3AED&color=fff&size=40`}
                  alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-violet-500/20 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200 truncate">
                    {seller.sellerProfile?.shopName || seller.name}
                  </p>
                  <p className="text-xs text-zinc-600 truncate">{seller.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-zinc-100">{seller.sellerProfile?.totalSales} sales</p>
                  <p className="text-xs text-amber-400"><Star className="inline w-5 h-5 mr-1 align-text-bottom" /> {seller.sellerProfile?.rating?.toFixed(1) || '—'}</p>
                </div>
              </Link>
            ))}
            {topSellers.length === 0 && <p className="text-center py-8 text-sm text-zinc-600">No sales yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
