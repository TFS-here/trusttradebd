import { Check } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../../api/adminApi';

const ESCROW_STYLES = {
  LOCKED:    'badge-amber',
  SHIPPED:   'badge-violet',
  DELIVERED: 'badge-violet',
  RELEASED:  'badge-emerald',
  ON_HOLD:   'badge-rose',
  REFUNDED:  'badge-zinc',
};

const ActionModal = ({ order, action, onConfirm, onCancel }) => {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const configs = {
    hold:    { title: 'Place on Hold',     btn: 'Hold Order',    cls: 'btn-danger',   required: true  },
    release: { title: 'Release to Seller', btn: 'Release Funds', cls: 'btn-emerald',  required: false },
    refund:  { title: 'Refund to Buyer',   btn: 'Issue Refund',  cls: 'btn-danger',   required: false },
    simulate_delivery: { title: 'Simulate Pathao Delivery', btn: 'Trigger Webhook', cls: 'btn-primary', required: false },
  };
  const cfg = configs[action];

  const handle = async () => {
    if (cfg.required && !note.trim()) { setError('A reason is required.'); return; }
    setLoading(true); setError('');
    try { await onConfirm(note.trim()); }
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
        <div>
          <h3 className="font-bold text-zinc-100 text-lg">{cfg.title}</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Order #{order?._id.slice(-8).toUpperCase()} · ৳{order?.totalAmount?.toLocaleString('en-BD')}
          </p>
        </div>
        {action === 'release' && (
          <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-4 py-3 text-sm text-emerald-400">
            ৳{((order?.totalAmount || 0) * 0.975).toFixed(2)} will be credited to seller's wallet (after 2.5% fee).
          </div>
        )}
        {action === 'refund' && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm text-rose-400">
            Full ৳{order?.totalAmount?.toLocaleString('en-BD')} will be returned to buyer's wallet.
          </div>
        )}
        <textarea autoFocus value={note} onChange={e => setNote(e.target.value)}
          placeholder={cfg.required ? 'Reason (required)…' : 'Admin note (optional)…'}
          rows={3} className="input resize-none" />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 btn-secondary text-sm py-2.5">Cancel</button>
          <button onClick={handle} disabled={loading} className={`flex-1 ${cfg.cls} text-sm py-2.5`}>
            {loading ? 'Processing…' : cfg.btn}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const STATUS_FILTERS = ['', 'LOCKED', 'SHIPPED', 'DELIVERED', 'RELEASED', 'ON_HOLD', 'REFUNDED'];

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [feedback, setFeedback] = useState({});

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await adminApi.getOrders(params);
      setOrders(data.data.orders); setPagination(data.data.pagination);
    } finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const showFeedback = (id, msg) => {
    setFeedback(p => ({ ...p, [id]: msg }));
    setTimeout(() => setFeedback(p => ({ ...p, [id]: null })), 3000);
  };

  const handleAction = async (note) => {
    const { action, order } = modal;
    let res;
    if (action === 'hold')    res = await adminApi.holdOrder(order._id, note || 'Admin hold');
    else if (action === 'release') res = await adminApi.releaseOrder(order._id, note);
    else if (action === 'refund')  res = await adminApi.refundOrder(order._id, note);
    else if (action === 'simulate_delivery') {
      res = await adminApi.simulateDelivery(order._id);
      fetchOrders(); // Refetch all to get updated statuses safely
      setModal(null);
      showFeedback(order._id, 'Simulated Delivery');
      return;
    }
    const updated = res.data.data.order;
    setOrders(p => p.map(o => o._id === updated._id ? updated : o));
    setModal(null);
    showFeedback(order._id, action === 'hold' ? 'On hold' : action === 'release' ? 'Released' : 'Refunded');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <p className="section-label mb-1">Management</p>
        <h1 className="text-2xl font-bold text-zinc-100">Orders</h1>
        {pagination && <p className="text-sm text-zinc-600 mt-0.5">{pagination.total} total orders</p>}
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(s => (
          <button key={s || 'all'} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                        ${statusFilter === s
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                          : 'bg-surface-2 text-zinc-500 border border-white/5 hover:border-violet-500/20 hover:text-zinc-300'}`}>
            {s || 'All'}
            {s === 'ON_HOLD' && <span className="ml-1.5 text-rose-400">●</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-surface-2 rounded-xl" />)}
          </div>
        ) : orders.length === 0 ? (
          <p className="text-center py-12 text-zinc-600 text-sm">No orders found.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {orders.map(order => {
              const isActionable = !['RELEASED', 'REFUNDED'].includes(order.escrowStatus);
              const isOnHold = order.escrowStatus === 'ON_HOLD';
              return (
                <motion.div key={order._id} layout
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link to={`/orders/${order._id}`} className="font-mono text-sm font-semibold text-zinc-200 hover:text-violet-400 hover:underline transition">
                        #{order._id.slice(-8).toUpperCase()}
                      </Link>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ESCROW_STYLES[order.escrowStatus] || 'badge-zinc'}`}>
                        {order.escrowStatus}
                      </span>
                    </div>
                    {order.items?.length > 0 && (
                      <p className="text-sm font-medium text-zinc-300 mt-0.5 mb-1 truncate">
                        {order.items.map((item, idx) => (
                          <span key={idx}>
                            <Link to={`/products/${item.product}`} className="hover:text-violet-400 hover:underline transition">
                              {item.title}
                            </Link>
                            {idx < order.items.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </p>
                    )}
                    <p className="text-xs text-zinc-600 truncate">
                      <span className="text-zinc-500">{order.buyer?.name}</span>
                      {' → '}
                      <span className="text-zinc-500">{order.seller?.sellerProfile?.shopName || order.seller?.name}</span>
                    </p>
                    {order.disputeNote && (
                      <p className="text-xs text-amber-400/70 mt-0.5 italic truncate">Note: {order.disputeNote}</p>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-zinc-100 shrink-0 hidden sm:block">
                    ৳{order.totalAmount.toLocaleString('en-BD')}
                  </p>
                  <AnimatePresence>
                    {feedback[order._id] && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-xs text-emerald-400 font-medium shrink-0"><Check className="inline w-5 h-5 mr-1 align-text-bottom" /> {feedback[order._id]}</motion.span>
                    )}
                  </AnimatePresence>
                  {isActionable && (
                    <div className="flex items-center gap-2 shrink-0">
                      {order.escrowStatus === 'SHIPPED' && (
                        <button onClick={() => setModal({ action: 'simulate_delivery', order })}
                          className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition font-medium">
                          Simulate Delivery
                        </button>
                      )}
                      {!isOnHold && (
                        <button onClick={() => setModal({ action: 'hold', order })}
                          className="text-xs px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 hover:bg-amber-400/20 transition font-medium">
                          Hold
                        </button>
                      )}
                      {isOnHold && (
                        <>
                          <button onClick={() => setModal({ action: 'release', order })}
                            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20 transition font-medium">
                            Release
                          </button>
                          <button onClick={() => setModal({ action: 'refund', order })}
                            className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition font-medium">
                            Refund
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex justify-center gap-2 px-5 py-4 border-t border-white/5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!pagination.hasPrev}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-30">← Prev</button>
            <span className="px-3 py-1.5 text-sm text-zinc-600">{pagination.page} / {pagination.pages}</span>
            <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={!pagination.hasNext}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-30">Next →</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modal && <ActionModal order={modal.order} action={modal.action} onConfirm={handleAction} onCancel={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default AdminOrders;
