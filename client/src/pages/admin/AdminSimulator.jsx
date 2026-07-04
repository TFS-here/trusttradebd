import { Radio, Mailbox } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../../api/adminApi';

const PATHAO_STATUSES = [
  { key: 'Pickup_Requested', label: ' Pickup Requested', color: 'amber' },
  { key: 'On_The_Way',       label: ' In Transit',       color: 'blue'  },
  { key: 'Delivered',        label: ' Delivered',         color: 'emerald' },
  { key: 'Partial_Delivery', label: ' Partial Delivery',  color: 'orange' },
  { key: 'Return_In_Transit',label: '↩️ Returning',         color: 'rose'  },
  { key: 'Returned',         label: ' Returned to Seller',color: 'rose'  },
];

const COLOR_CLASSES = {
  amber:   'bg-amber-400/10 border-amber-400/20 text-amber-400 hover:bg-amber-400/20',
  blue:    'bg-blue-400/10 border-blue-400/20 text-blue-400 hover:bg-blue-400/20',
  emerald: 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20',
  orange:  'bg-orange-400/10 border-orange-400/20 text-orange-400 hover:bg-orange-400/20',
  rose:    'bg-rose-400/10 border-rose-400/20 text-rose-400 hover:bg-rose-400/20',
};

const AdminSimulator = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({}); // orderId → { msg, error }
  const [busy, setBusy] = useState({}); // orderId:status → true

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.getOrders({ status: 'SHIPPED', limit: 50 });
      setOrders(data.data.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleSimulate = async (orderId, status) => {
    const key = `${orderId}:${status}`;
    setBusy(p => ({ ...p, [key]: true }));
    try {
      const { data } = await adminApi.simulateStatus(orderId, status);
      setFeedback(p => ({ ...p, [orderId]: { msg: data.message, error: false } }));
      // Refetch after a short delay so the list updates
      setTimeout(fetchOrders, 800);
    } catch (err) {
      setFeedback(p => ({
        ...p,
        [orderId]: { msg: err.response?.data?.message || 'Failed', error: true }
      }));
    } finally {
      setBusy(p => ({ ...p, [key]: false }));
      setTimeout(() => setFeedback(p => ({ ...p, [orderId]: null })), 4000);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">Admin Tools</p>
          <h1 className="text-2xl font-bold text-zinc-100">Pathao Sandbox Simulator</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Trigger any Pathao courier status for orders currently in <span className="text-violet-400 font-medium">SHIPPED</span> state.
          </p>
        </div>
        <button onClick={fetchOrders} className="btn-secondary text-sm px-4 py-2 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Info box */}
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl px-5 py-4 text-sm text-zinc-400 leading-relaxed">
        <p className="font-semibold text-violet-400 mb-1"><Radio className="inline w-5 h-5 mr-1 align-text-bottom" /> How this works</p>
        <p>In production, Pathao automatically sends these status updates to your webhook as the courier moves through the delivery lifecycle. In Sandbox mode, you use this panel to manually trigger each step to test the full buyer experience.</p>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-surface-2 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card rounded-2xl px-5 py-16 text-center">
          <p className="text-3xl mb-3"><Mailbox className="inline w-5 h-5 mr-1 align-text-bottom" /></p>
          <p className="text-zinc-400 font-medium">No shipped orders to simulate</p>
          <p className="text-sm text-zinc-600 mt-1">Orders must be in SHIPPED state to appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <motion.div
              key={order._id}
              layout
              className="card rounded-2xl px-5 py-5 space-y-4"
            >
              {/* Order info */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-zinc-200">
                      #{order._id.slice(-8).toUpperCase()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-medium">
                      SHIPPED
                    </span>
                  </div>
                  {order.items?.[0] && (
                    <p className="text-sm text-zinc-400 truncate max-w-xs">{order.items[0].title}</p>
                  )}
                  {order.trackingNumber && (
                    <p className="text-xs text-zinc-600 mt-0.5 font-mono">
                      Tracking: {order.trackingNumber}
                    </p>
                  )}
                </div>
                <p className="font-semibold text-zinc-100 shrink-0">
                  ৳{order.totalAmount?.toLocaleString('en-BD')}
                </p>
              </div>

              {/* Feedback */}
              <AnimatePresence>
                {feedback[order._id] && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`text-xs font-medium px-3 py-2 rounded-lg
                      ${feedback[order._id].error
                        ? 'bg-rose-500/10 text-rose-400'
                        : 'bg-emerald-400/10 text-emerald-400'}`}
                  >
                    {feedback[order._id].msg}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Status buttons */}
              <div className="flex flex-wrap gap-2">
                {PATHAO_STATUSES.map(({ key, label, color }) => {
                  const busyKey = `${order._id}:${key}`;
                  return (
                    <button
                      key={key}
                      disabled={!!busy[busyKey]}
                      onClick={() => handleSimulate(order._id, key)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition disabled:opacity-50
                        ${COLOR_CLASSES[color]}`}
                    >
                      {busy[busyKey] ? ' Sending…' : label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSimulator;
