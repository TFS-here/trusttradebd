import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../../api/adminApi';

const statusStyles = {
  Pending:     'bg-amber-400/10 text-amber-400 border-amber-400/20',
  Buyer_Won:   'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  Seller_Won:  'bg-blue-400/10 text-blue-400 border-blue-400/20',
  Closed:      'bg-zinc-400/10 text-zinc-400 border-zinc-400/20',
};

const AdminDisputes = () => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // For detail modal
  const [resolving, setResolving] = useState(false);
  const [resolveForm, setResolveForm] = useState({ adminNotes: '', deliveryFeePenalty: 100 });
  const [successMsg, setSuccessMsg] = useState('');

  const fetchDisputes = useCallback(async () => {
    try {
      const { data } = await adminApi.getDisputes();
      setDisputes(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load disputes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const handleResolveBuyerFavor = async () => {
    if (!selected) return;
    setResolving(true); setError(''); setSuccessMsg('');
    try {
      await adminApi.resolveDisputeBuyerFavor(selected._id, resolveForm);
      setSuccessMsg('Dispute resolved in buyer\'s favor. Refund issued & seller penalized.');
      setSelected(null);
      setResolveForm({ adminNotes: '', deliveryFeePenalty: 100 });
      await fetchDisputes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve dispute.');
    } finally { setResolving(false); }
  };

  const handleResolveSellerFavor = async () => {
    if (!selected) return;
    setResolving(true); setError(''); setSuccessMsg('');
    try {
      await adminApi.resolveDisputeSellerFavor(selected._id, { adminNotes: resolveForm.adminNotes });
      setSuccessMsg('Dispute rejected. Funds released to seller.');
      setSelected(null);
      setResolveForm({ adminNotes: '', deliveryFeePenalty: 100 });
      await fetchDisputes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve dispute.');
    } finally { setResolving(false); }
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-pulse space-y-4">
      <div className="h-8 bg-surface-2 rounded-xl w-1/3" />
      <div className="h-48 bg-surface-2 rounded-2xl" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <p className="section-label mb-1">Admin</p>
        <h1 className="text-2xl font-bold text-zinc-100">Dispute Management</h1>
        <p className="text-sm text-zinc-600 mt-0.5">
          Review and resolve buyer–seller disputes with evidence
        </p>
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
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disputes Table */}
      <div className="card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <p className="font-semibold text-zinc-200">All Disputes ({disputes.length})</p>
        </div>

        {disputes.length === 0 ? (
          <div className="px-5 py-12 text-center text-zinc-600">
            <p className="text-lg">🎉 No disputes found</p>
            <p className="text-sm mt-1">All transactions are clean.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-600 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3">Dispute ID</th>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Buyer</th>
                  <th className="px-5 py-3">Seller</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {disputes.map((d) => (
                  <tr key={d._id} className="hover:bg-white/[0.02] transition">
                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">
                      #{d._id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-violet-400">
                      #{d.order?._id?.slice(-6).toUpperCase() || '—'}
                    </td>
                    <td className="px-5 py-3 text-zinc-300">
                      {d.buyer?.name || '—'}
                    </td>
                    <td className="px-5 py-3 text-zinc-300">
                      {d.seller?.name || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-lg border ${statusStyles[d.status] || statusStyles.Closed}`}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500 max-w-[200px] truncate">
                      {d.reason}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setSelected(d)}
                        className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail / Resolve Modal ─────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="card-glass rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">Dispute Details</h3>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    #{selected._id.slice(-8).toUpperCase()} · {new Date(selected.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${statusStyles[selected.status]}`}>
                  {selected.status.replace('_', ' ')}
                </span>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-surface-2/50 rounded-xl p-3">
                  <p className="text-xs text-zinc-600 mb-1">Buyer</p>
                  <p className="font-medium text-zinc-200">{selected.buyer?.name || '—'}</p>
                  <p className="text-xs text-zinc-500">{selected.buyer?.email}</p>
                </div>
                <div className="bg-surface-2/50 rounded-xl p-3">
                  <p className="text-xs text-zinc-600 mb-1">Seller</p>
                  <p className="font-medium text-zinc-200">{selected.seller?.name || '—'}</p>
                  <p className="text-xs text-zinc-500">{selected.seller?.email}</p>
                </div>
              </div>

              {/* Reason */}
              <div className="bg-surface-2/50 rounded-xl p-3">
                <p className="text-xs text-zinc-600 mb-1">Reason</p>
                <p className="text-sm text-zinc-300">{selected.reason}</p>
              </div>

              {/* Evidence — inline video player + fallback link */}
              {(selected.unboxingVideoUrl || selected.adminReportPdfUrl) && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Evidence</p>
                  {selected.unboxingVideoUrl && (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-600">🎥 Unboxing Video</p>
                      <video
                        src={selected.unboxingVideoUrl}
                        controls
                        className="w-full rounded-xl border border-white/10 bg-black max-h-64 object-contain"
                      />
                      <a href={selected.unboxingVideoUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-block text-xs text-violet-400 hover:underline">
                        Open in new tab ↗
                      </a>
                    </div>
                  )}
                  {selected.adminReportPdfUrl && (
                    <a href={selected.adminReportPdfUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 
                                 px-3 py-2 rounded-xl text-xs font-medium hover:bg-amber-500/20 transition">
                      📄 Admin Report PDF
                    </a>
                  )}
                </div>
              )}

              {/* Resolve Form — only for Pending disputes */}
              {selected.status === 'Pending' && (
                <div className="space-y-3 pt-3 border-t border-white/5">
                  <p className="text-sm font-semibold text-zinc-200">Resolve Dispute</p>
                  <div>
                    <label className="text-xs text-zinc-600 block mb-1">Admin Notes</label>
                    <textarea
                      value={resolveForm.adminNotes}
                      onChange={(e) => setResolveForm(prev => ({ ...prev, adminNotes: e.target.value }))}
                      placeholder="Describe the evidence and your ruling..."
                      rows={3}
                      className="w-full bg-surface-3/50 border border-white/5 rounded-xl px-3.5 py-2.5 text-sm 
                                 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 transition resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-600 block mb-1">Delivery Fee Penalty (BDT)</label>
                    <input
                      type="number"
                      value={resolveForm.deliveryFeePenalty}
                      onChange={(e) => setResolveForm(prev => ({ ...prev, deliveryFeePenalty: Number(e.target.value) }))}
                      className="w-full bg-surface-3/50 border border-white/5 rounded-xl px-3.5 py-2.5 text-sm 
                                 text-zinc-200 focus:outline-none focus:border-violet-500/40 transition"
                    />
                  </div>
                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      onClick={handleResolveBuyerFavor}
                      disabled={resolving || !resolveForm.adminNotes.trim()}
                      className="w-full text-sm py-2.5 font-semibold rounded-xl transition disabled:opacity-60
                                 bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30">
                      {resolving ? 'Processing…' : '🔴 Rule in Buyer\'s Favor (Refund + Penalize Seller)'}
                    </button>
                    <button
                      onClick={handleResolveSellerFavor}
                      disabled={resolving || !resolveForm.adminNotes.trim()}
                      className="w-full text-sm py-2.5 font-semibold rounded-xl transition disabled:opacity-60
                                 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30">
                      {resolving ? 'Processing…' : '🟢 Rule in Seller\'s Favor (Release Funds)'}
                    </button>
                    <button onClick={() => setSelected(null)} className="w-full btn-secondary text-sm py-2">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Already resolved info */}
              {selected.status !== 'Pending' && selected.adminNotes && (
                <div className="bg-surface-2/50 rounded-xl p-3">
                  <p className="text-xs text-zinc-600 mb-1">Admin Notes</p>
                  <p className="text-sm text-zinc-300">{selected.adminNotes}</p>
                  {selected.resolvedAt && (
                    <p className="text-xs text-zinc-600 mt-2">
                      Resolved on {new Date(selected.resolvedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDisputes;
