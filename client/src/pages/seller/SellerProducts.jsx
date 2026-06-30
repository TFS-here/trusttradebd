import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMyProducts } from '../../hooks/useProduct';
import StockBadge from '../../components/product/StockBadge';

const ReasonModal = ({ title, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handle = async () => {
    if (!reason.trim()) { setError('Reason is required.'); return; }
    setLoading(true);
    try { await onConfirm(reason.trim()); }
    catch (err) { setError(err.response?.data?.message || 'Failed.'); }
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
          placeholder="State the reason…" rows={3}
          className="input resize-none" />
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

const RestockModal = ({ product, onConfirm, onClose }) => {
  const [qty, setQty] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handle = async () => {
    const n = parseInt(qty, 10);
    if (!qty || isNaN(n) || n < 1) { setError('Enter a valid quantity (at least 1).'); return; }
    setLoading(true);
    try { await onConfirm(product._id, n); onClose(); }
    catch (err) { setError(err.response?.data?.message || 'Restock failed.'); }
    finally { setLoading(false); }
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="card-glass rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
        <h3 className="font-bold text-zinc-100">Restock Product</h3>
        <p className="text-sm text-zinc-500 line-clamp-1">{product.title}</p>
        <StockBadge stock={product.stock} showCount />
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">Units to add</label>
          <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
            placeholder="e.g. 50" className="input" onKeyDown={e => e.key === 'Enter' && handle()} autoFocus />
        </div>
        {qty && !isNaN(parseInt(qty)) && parseInt(qty) > 0 && (
          <p className="text-sm text-zinc-500">New stock: <span className="font-semibold text-emerald-400">{product.stock + parseInt(qty)}</span></p>
        )}
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 btn-secondary text-sm py-2.5">Cancel</button>
          <button onClick={handle} disabled={loading} className="flex-1 btn-primary text-sm py-2.5">
            {loading ? 'Restocking…' : 'Confirm Restock'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Out of Stock', value: 'out_of_stock' },
  { label: 'Inactive', value: 'inactive' },
];

const SellerProducts = () => {
  const { products, pagination, loading, error, setParams, refetch, restock, toggleActive } = useMyProducts();
  const [activeFilter, setActiveFilter] = useState('');
  const [restockTarget, setRestockTarget] = useState(null);
  const [feedback, setFeedback] = useState({});

  const handleFilterChange = (value) => { setActiveFilter(value); setParams({ status: value, page: 1 }); };
  const handleToggle = async (product) => {
    try {
      await toggleActive(product._id, product.isActive);
      setFeedback(p => ({ ...p, [product._id]: 'Updated' }));
      setTimeout(() => setFeedback(p => ({ ...p, [product._id]: null })), 2500);
    } catch { setFeedback(p => ({ ...p, [product._id]: 'Error' })); }
  };
  const handleRestock = async (productId, qty) => {
    await restock(productId, qty);
    setFeedback(p => ({ ...p, [productId]: 'Restocked!' }));
    setTimeout(() => setFeedback(p => ({ ...p, [productId]: null })), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="section-label mb-1">Seller</p>
          <h1 className="text-2xl font-bold text-zinc-100">My Products</h1>
          {pagination && <p className="text-sm text-zinc-600 mt-0.5">{pagination.total} total listings</p>}
        </div>
        <Link to="/seller/products/new" className="btn-primary text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Product
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(({ label, value }) => (
          <button key={value} onClick={() => handleFilterChange(value)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                        ${activeFilter === value
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                          : 'bg-surface-2 text-zinc-500 border border-white/5 hover:border-violet-500/20 hover:text-zinc-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="text-center py-12"><p className="text-zinc-600">{error}</p><button onClick={refetch} className="mt-3 text-violet-400 hover:text-violet-300 text-sm">Try again</button></div>}
      {loading && <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-surface-2 rounded-2xl animate-pulse" />)}</div>}

      {!loading && !error && products.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-white/5 flex items-center justify-center text-3xl mx-auto mb-4">📦</div>
          <h3 className="font-semibold text-zinc-400">No products yet</h3>
          <p className="text-sm text-zinc-600 mt-1">Create your first listing to start selling.</p>
          <Link to="/seller/products/new" className="mt-4 inline-block text-violet-400 hover:text-violet-300 text-sm">Create a product →</Link>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="space-y-2">
          {products.map(product => (
            <motion.div key={product._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="card rounded-2xl flex items-center gap-4 px-5 py-4 hover:border-white/10 transition-all card-hover">
              <img src={product.images?.[0] || '/placeholder-product.jpg'} alt={product.title}
                className="w-14 h-14 rounded-xl object-cover shrink-0 bg-surface-3"
                onError={e => { e.target.src = '/placeholder-product.jpg'; }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-zinc-200 truncate text-sm">{product.title}</p>
                <p className="text-sm text-violet-400 font-medium">৳{product.price.toLocaleString('en-BD')}</p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <StockBadge stock={product.stock} showCount size="sm" />
                <span className="text-xs text-zinc-600">{product.stock} units</span>
              </div>
              <AnimatePresence>
                {feedback[product._id] && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-emerald-400 font-medium shrink-0">
                    ✓ {feedback[product._id]}
                  </motion.span>
                )}
              </AnimatePresence>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setRestockTarget(product)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-surface-2 border border-white/8 text-zinc-400 hover:border-emerald-400/30 hover:text-emerald-400 transition font-medium">
                  + Restock
                </button>
                <button onClick={() => handleToggle(product)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition
                              ${product.isActive
                                ? 'bg-surface-2 border-white/8 text-zinc-400 hover:border-rose-500/30 hover:text-rose-400'
                                : 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20'}`}>
                  {product.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <Link to={`/seller/products/${product._id}/edit`}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition font-medium">
                  Edit
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {restockTarget && (
          <RestockModal product={restockTarget} onConfirm={handleRestock} onClose={() => setRestockTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SellerProducts;
