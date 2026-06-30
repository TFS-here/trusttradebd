import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { orderApi } from '../../api/orderApi';

const STATUS_STYLES = {
  LOCKED:    'badge-amber',
  SHIPPED:   'badge-violet',
  DELIVERED: 'badge-violet',
  RELEASED:  'badge-emerald',
  ON_HOLD:   'badge-rose',
  REFUNDED:  'badge-zinc',
};

const STATUS_FILTERS = ['', 'LOCKED', 'SHIPPED', 'DELIVERED', 'RELEASED', 'ON_HOLD', 'REFUNDED'];

const SellerOrders = () => {
  const [orders, setOrders]         = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatus]   = useState('');
  const [page, setPage]             = useState(1);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await orderApi.getAll(params);
      setOrders(data.data.orders); setPagination(data.data.pagination);
    } finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="section-label mb-1">Seller</p>
        <h1 className="text-2xl font-bold text-zinc-100">Incoming Orders</h1>
        {pagination && <p className="text-sm text-zinc-600 mt-0.5">{pagination.total} total orders</p>}
      </div>

      {/* Status filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(s => (
          <button key={s || 'all'} onClick={() => { setStatus(s); setPage(1); }}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                        ${statusFilter === s
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                          : 'bg-surface-2 text-zinc-500 border border-white/5 hover:border-violet-500/20 hover:text-zinc-300'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div className="space-y-3">
        {loading && [...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-surface-2 rounded-2xl animate-pulse" />
        ))}

        {!loading && orders.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-white/5 flex items-center justify-center text-3xl mx-auto mb-4">📭</div>
            <p className="text-zinc-600">No orders yet.</p>
          </div>
        )}

        {!loading && orders.map(order => (
          <motion.div key={order._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="card rounded-2xl flex items-center gap-4 px-5 py-4 card-hover">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold text-zinc-200">
                  #{order._id.slice(-8).toUpperCase()}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLES[order.escrowStatus] || 'badge-zinc'}`}>
                  {order.escrowStatus}
                </span>
              </div>
              <p className="text-xs text-zinc-600">
                {order.items.length} item{order.items.length !== 1 ? 's' : ''} ·
                Buyer: <span className="text-zinc-500">{order.buyer?.name}</span> ·{' '}
                {new Date(order.createdAt).toLocaleDateString('en-BD', { day:'numeric', month:'short', year:'numeric' })}
              </p>
            </div>
            <p className="font-bold text-zinc-100 shrink-0">৳{order.totalAmount.toLocaleString('en-BD')}</p>
            <Link to={`/seller/orders/${order._id}`}
              className={`shrink-0 text-xs px-4 py-2 rounded-xl font-medium transition
                          ${order.escrowStatus === 'LOCKED'
                            ? 'bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30'
                            : 'bg-surface-2 border border-white/8 text-zinc-400 hover:border-violet-500/20 hover:text-violet-400'}`}>
              {order.escrowStatus === 'LOCKED' ? 'Ship →' : 'View'}
            </Link>
          </motion.div>
        ))}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={!pagination.hasPrev}
            className="btn-secondary text-sm px-4 py-2 disabled:opacity-30">← Prev</button>
          <span className="px-4 py-2 text-sm text-zinc-600">{pagination.page} / {pagination.pages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.pages, p+1))} disabled={!pagination.hasNext}
            className="btn-secondary text-sm px-4 py-2 disabled:opacity-30">Next →</button>
        </div>
      )}
    </div>
  );
};

export default SellerOrders;
