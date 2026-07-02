import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { orderApi } from '../../api/orderApi';
import EscrowTracker from '../../components/product/EscrowTracker';
import WriteReview from '../../components/review/WriteReview';
import OrderChat from '../../components/chat/OrderChat';

const ConfirmDialog = ({ title, message, onConfirm, onCancel, loading, danger = false }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onClick={onCancel}>
    <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
      onClick={e => e.stopPropagation()}
      className="card-glass rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
      <h3 className="text-lg font-bold text-zinc-100 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 btn-secondary text-sm py-2.5">Go back</button>
        <button onClick={onConfirm} disabled={loading}
          className={`flex-1 text-sm py-2.5 font-semibold rounded-xl transition disabled:opacity-60
                      ${danger ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30'
                               : 'btn-primary'}`}>
          {loading ? 'Processing…' : 'Confirm'}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const OrderDetail = ({ role = 'buyer' }) => {
  const { id } = useParams();
  const [order, setOrder]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [actionLoading, setActLoad] = useState(false);
  const [actionError, setActErr]    = useState('');
  const [successMsg, setSuccess]    = useState('');
  const [dialog, setDialog]         = useState(null);
  const [trackingInput, setTracking]= useState('');
  const [downloading, setDownload]  = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const { data } = await orderApi.getById(id);
      setOrder(data.data.order);
    } catch (err) { setError(err.response?.data?.message || 'Order not found.'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleAction = async (action) => {
    setActLoad(true); setActErr(''); setSuccess('');
    try {
      let res;
      if (action === 'confirm_delivery') res = await orderApi.confirmDelivery(id);
      else if (action === 'cancel')      res = await orderApi.cancel(id);
      else if (action === 'ship')        res = await orderApi.ship(id, { trackingNumber: trackingInput });
      setSuccess(res.data.message); setOrder(res.data.data.order); setDialog(null);
    } catch (err) { setActErr(err.response?.data?.message || 'Action failed.'); }
    finally { setActLoad(false); }
  };

  const handleDownloadReceipt = async () => {
    setDownload(true);
    try {
      const token = localStorage.getItem('tt_token');
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/orders/${id}/receipt`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `TrustTrade-Receipt-${id.slice(-8).toUpperCase()}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch { console.error('Receipt download failed'); }
    finally { setDownload(false); }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse space-y-4">
      <div className="h-8 bg-surface-2 rounded-xl w-1/3" />
      <div className="h-48 bg-surface-2 rounded-2xl" />
      <div className="h-64 bg-surface-2 rounded-2xl" />
    </div>
  );

  if (error || !order) return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-center">
      <p className="text-zinc-600">{error || 'Order not found.'}</p>
    </div>
  );

  const { escrowStatus, totalAmount, items, shippingAddress, seller, buyer,
          trackingNumber, escrowHistory, createdAt, platformFee, sellerReceives } = order;
  const isTerminal = ['RELEASED', 'REFUNDED'].includes(escrowStatus);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="section-label mb-1">Order</p>
          <h1 className="text-2xl font-bold text-zinc-100">Order Details</h1>
          <p className="text-sm text-zinc-600 mt-0.5">
            #{order._id.slice(-8).toUpperCase()} ·{' '}
            {new Date(createdAt).toLocaleDateString('en-BD', { day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <button onClick={handleDownloadReceipt} disabled={downloading}
          className="btn-secondary text-sm flex items-center gap-2 shrink-0">
          {downloading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          {downloading ? 'Generating…' : 'Receipt'}
        </button>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 rounded-xl px-4 py-3 text-sm font-medium">
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successMsg}
          </motion.div>
        )}
        {actionError && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 text-sm">
            {actionError}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — 2/3 */}
        <div className="lg:col-span-2 space-y-5">
          {/* Items */}
          <div className="card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <p className="font-semibold text-zinc-200">Items ({items.length})</p>
            </div>
            <div className="divide-y divide-white/5">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <img src={item.image || '/placeholder-product.jpg'} alt={item.title}
                    className="w-14 h-14 rounded-xl object-cover bg-surface-3 shrink-0"
                    onError={e => { e.target.src = '/placeholder-product.jpg'; }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-200 text-sm line-clamp-1">{item.title}</p>
                    <p className="text-xs text-zinc-600">৳{item.price.toLocaleString('en-BD')} × {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-zinc-100 shrink-0">৳{(item.price * item.quantity).toLocaleString('en-BD')}</p>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="px-5 py-4 bg-surface-2/50 space-y-2 border-t border-white/5">
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Subtotal</span><span>৳{totalAmount.toLocaleString('en-BD')}</span>
              </div>
              {escrowStatus === 'RELEASED' && (
                <>
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Platform fee (2.5%)</span><span>−৳{platformFee?.toLocaleString('en-BD')}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-emerald-400 pt-1 border-t border-white/5">
                    <span>Seller received</span><span>৳{sellerReceives?.toLocaleString('en-BD')}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-zinc-100 pt-1 border-t border-white/5">
                <span>Total paid</span><span>৳{totalAmount.toLocaleString('en-BD')}</span>
              </div>
            </div>
          </div>

          {/* Shipping */}
          <div className="card rounded-2xl px-5 py-4">
            <p className="font-semibold text-zinc-200 mb-3">Shipping Address</p>
            <div className="text-sm text-zinc-400 space-y-0.5">
              <p className="font-medium text-zinc-200">{shippingAddress.fullName}</p>
              <p>{shippingAddress.address}</p>
              <p>{shippingAddress.city}{shippingAddress.district ? `, ${shippingAddress.district}` : ''}</p>
              <p>{shippingAddress.phone}</p>
            </div>
            {trackingNumber && (
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Logistics Partner</p>
                  <div className="flex items-center gap-2">
                    <span className="bg-red-500/10 text-red-500 text-xs font-bold px-2 py-0.5 rounded">Pathao</span>
                    <p className="font-mono text-sm font-semibold text-zinc-100">{trackingNumber}</p>
                  </div>
                </div>
                <a href="https://pathao.com/bd/courier/" 
                   target="_blank" rel="noreferrer"
                   onClick={(e) => {
                     navigator.clipboard.writeText(trackingNumber);
                     alert('Tracking ID copied to clipboard! Paste it on the Pathao website.');
                   }}
                   className="btn-primary py-1.5 px-3 text-xs bg-white/5 hover:bg-white/10 text-white border-0">
                  Track Parcel
                </a>
              </div>
            )}
          </div>

          {/* Counterparty */}
          <div className="card rounded-2xl px-5 py-4">
            <p className="font-semibold text-zinc-200 mb-3">{role === 'buyer' ? 'Seller' : 'Buyer'}</p>
            {(() => {
              const party = role === 'buyer' ? seller : buyer;
              return party ? (
                <div className="flex items-center gap-3">
                  <img src={party.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(party.name)}&background=7C3AED&color=fff&size=40`}
                    alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-violet-500/20" />
                  <div>
                    <p className="font-medium text-sm text-zinc-200">
                      {role === 'buyer' ? party.sellerProfile?.shopName || party.name : party.name}
                    </p>
                    <p className="text-xs text-zinc-600">{party.email}</p>
                  </div>
                </div>
              ) : null;
            })()}
          </div>

          {/* Actions */}
          {!isTerminal && (
            <div className="flex flex-wrap gap-3">
              {role === 'buyer' && escrowStatus === 'SHIPPED' && (
                <button onClick={() => setDialog({ type: 'confirm_delivery' })}
                  className="flex-1 btn-emerald py-3 text-sm">
                  ✅ Confirm Delivery & Release Payment
                </button>
              )}
              {role === 'buyer' && escrowStatus === 'LOCKED' && (
                <button onClick={() => setDialog({ type: 'cancel' })}
                  className="px-5 py-3 btn-danger text-sm">
                  Cancel Order
                </button>
              )}
              {role === 'seller' && escrowStatus === 'LOCKED' && (
                <button onClick={() => setDialog({ type: 'ship' })} className="flex-1 btn-primary py-3">
                  🚀 Generate Pathao Consignment & Dispatch
                </button>
              )}
            </div>
          )}

          {/* Write review */}
          {role === 'buyer' && order && (
            <WriteReview orderId={order._id} onSubmitted={() => { }} />
          )}
        </div>

        {/* Right — EscrowTracker */}
        <div>
          <EscrowTracker status={escrowStatus} escrowHistory={escrowHistory} role={role} />
        </div>
      </div>

      {/* Dialogs */}
      <AnimatePresence>
        {dialog?.type === 'confirm_delivery' && (
          <ConfirmDialog
            title="Confirm Delivery?"
            message={`This will release ৳${totalAmount.toLocaleString('en-BD')} to the seller's wallet. This cannot be undone.`}
            onConfirm={() => handleAction('confirm_delivery')}
            onCancel={() => setDialog(null)} loading={actionLoading} />
        )}
        {dialog?.type === 'cancel' && (
          <ConfirmDialog title="Cancel this order?"
            message={`৳${totalAmount.toLocaleString('en-BD')} will be refunded to your wallet immediately.`}
            onConfirm={() => handleAction('cancel')}
            onCancel={() => setDialog(null)} loading={actionLoading} danger />
        )}
        {dialog?.type === 'ship' && (
          <ConfirmDialog title="Mark as Shipped?"
            message="Confirm you have dispatched this order. The buyer will be notified to confirm delivery."
            onConfirm={() => handleAction('ship')}
            onCancel={() => setDialog(null)} loading={actionLoading} />
        )}
      </AnimatePresence>

      {/* ── P2P Secure Chat ──────────────────────────────────── */}
      <OrderChat orderId={id} />
    </div>
  );
};

export default OrderDetail;
