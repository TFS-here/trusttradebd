import { useState, useEffect } from 'react';
import { orderApi } from '../../api/orderApi';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const MetricCard = ({ title, value, icon, bg }) => (
  <div className={`card p-5 rounded-2xl flex items-center gap-4 ${bg}`}>
    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10 text-2xl shrink-0">
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

const STATUS_STYLES = {
  LOCKED:    'bg-amber-100 text-amber-700',
  SHIPPED:   'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-indigo-100 text-indigo-700',
  RELEASED:  'bg-emerald-100 text-emerald-700',
  ON_HOLD:   'bg-rose-100 text-rose-700',
  REFUNDED:  'bg-zinc-100 text-zinc-500',
};

const SellerAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    orderApi.getSellerAnalytics()
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-surface-2 rounded-2xl" />)}
        </div>
        <div className="h-64 bg-surface-2 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-rose-400">
        <p>{error}</p>
      </div>
    );
  }

  const { analytics, recentOrders } = data;
  const { totalOrders, completedOrders, pendingOrders, totalRevenue } = analytics;

  // Simple progress bar segments
  const completedPercent = totalOrders ? (completedOrders / totalOrders) * 100 : 0;
  const pendingPercent = totalOrders ? (pendingOrders / totalOrders) * 100 : 0;
  const otherPercent = totalOrders ? 100 - completedPercent - pendingPercent : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">Overview of your shop's performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Revenue" value={`৳${totalRevenue.toLocaleString('en-BD')}`} icon="" bg="text-emerald-400" />
        <MetricCard title="Total Orders" value={totalOrders} icon="" bg="text-violet-400" />
        <MetricCard title="Completed" value={completedOrders} icon="" bg="text-blue-400" />
        <MetricCard title="Pending" value={pendingOrders} icon="" bg="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 card p-6 rounded-2xl space-y-6">
          <h2 className="text-lg font-bold text-zinc-100">Order Status</h2>
          {totalOrders > 0 ? (
            <div className="space-y-4">
              <div className="h-4 rounded-full flex overflow-hidden bg-surface-3">
                <motion.div initial={{ width: 0 }} animate={{ width: `${completedPercent}%` }} transition={{ duration: 1 }} className="bg-emerald-400 h-full" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${pendingPercent}%` }} transition={{ duration: 1 }} className="bg-amber-400 h-full" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${otherPercent}%` }} transition={{ duration: 1 }} className="bg-rose-400 h-full" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-zinc-300">
                  <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-400" /> Completed</span>
                  <span className="font-semibold">{completedOrders}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400" /> Pending</span>
                  <span className="font-semibold">{pendingOrders}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-400" /> Other</span>
                  <span className="font-semibold">{totalOrders - completedOrders - pendingOrders}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No orders yet.</p>
          )}
        </div>

        <div className="lg:col-span-2 card rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h2 className="text-lg font-bold text-zinc-100">Recent Orders</h2>
            <Link to="/seller/orders" className="text-sm text-violet-400 hover:text-violet-300">View All →</Link>
          </div>
          <div className="flex-1 overflow-x-auto">
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">No recent orders to show.</div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white/5 text-zinc-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Order ID</th>
                    <th className="px-5 py-3 font-medium">Buyer</th>
                    <th className="px-5 py-3 font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentOrders.map(order => (
                    <tr key={order._id} className="hover:bg-white/3 transition">
                      <td className="px-5 py-3">
                        <Link to={`/seller/orders/${order._id}`} className="font-mono text-zinc-200 hover:text-violet-400 transition">
                          #{order._id.slice(-8).toUpperCase()}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-zinc-300">{order.buyer?.name || 'Unknown User'}</td>
                      <td className="px-5 py-3 text-zinc-200 font-medium">৳{order.totalAmount.toLocaleString('en-BD')}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide ${STATUS_STYLES[order.escrowStatus] || 'bg-zinc-100 text-zinc-600'}`}>
                          {order.escrowStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerAnalytics;
