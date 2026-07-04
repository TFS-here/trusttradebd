import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { reviewApi } from '../../api/reviewApi';
import { useAuth } from '../../context/AuthContext';
import StarRating from './StarRating';

const BreakdownBar = ({ star, count, total, active, onClick }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 group transition-opacity ${active === false ? 'opacity-40' : ''}`}>
      <span className="text-xs text-zinc-600 w-3 shrink-0">{star}</span>
      <svg className="w-3 h-3 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <div className="flex-1 bg-surface-3 rounded-full h-1.5 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: (5 - star) * 0.05 }}
          className="h-full bg-amber-400 rounded-full" />
      </div>
      <span className="text-xs text-zinc-600 w-5 text-right shrink-0">{count}</span>
    </button>
  );
};

const ReviewCard = ({ review, isSeller, onReplySubmitted }) => {
  const [replyOpen, setReplyOpen]   = useState(false);
  const [replyText, setReplyText]   = useState(review.sellerReply?.comment || '');
  const [replyLoading, setLoading]  = useState(false);
  const [replyError, setError]      = useState('');
  const hasReply = !!review.sellerReply?.comment;

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) { setError('Reply cannot be empty.'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await reviewApi.reply(review._id, replyText.trim());
      onReplySubmitted?.(review._id, data.data.review.sellerReply);
      setReplyOpen(false);
    } catch (err) { setError(err.response?.data?.message || 'Failed to post reply.'); }
    finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="py-5 border-b border-white/5 last:border-0">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <img src={review.reviewer?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.reviewer?.name||'U')}&background=7C3AED&color=fff&size=40`}
            alt={review.reviewer?.name}
            className="w-9 h-9 rounded-full object-cover ring-1 ring-violet-500/20 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-zinc-200">{review.reviewer?.name}</p>
            <p className="text-xs text-zinc-600">
              {new Date(review.createdAt).toLocaleDateString('en-BD', { day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>
        </div>
        <StarRating value={review.rating} readonly size="sm" />
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">{review.comment}</p>

      {hasReply && (
        <div className="mt-4 ml-4 pl-4 border-l-2 border-violet-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">Seller</span>
            <span className="text-xs text-zinc-600">
              {new Date(review.sellerReply.repliedAt).toLocaleDateString('en-BD', { day:'numeric', month:'short' })}
            </span>
          </div>
          <p className="text-sm text-zinc-400">{review.sellerReply.comment}</p>
          {isSeller && <button onClick={() => setReplyOpen(v => !v)} className="text-xs text-zinc-600 hover:text-violet-400 mt-1 transition">Edit reply</button>}
        </div>
      )}

      {isSeller && !hasReply && !replyOpen && (
        <button onClick={() => setReplyOpen(true)}
          className="mt-3 text-xs font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1 transition">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Reply to this review
        </button>
      )}

      <AnimatePresence>
        {replyOpen && (
          <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} onSubmit={handleReply}
            className="overflow-hidden mt-3 ml-4 pl-4 border-l-2 border-violet-500/20 space-y-2">
            <textarea autoFocus value={replyText} onChange={e => setReplyText(e.target.value.slice(0, 500))}
              placeholder="Write a professional, helpful reply…" rows={3} className="input resize-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-600">{500 - replyText.length} chars left</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setReplyOpen(false)} className="btn-ghost text-xs px-3 py-1.5">Cancel</button>
                <button type="submit" disabled={replyLoading} className="btn-primary text-xs px-3 py-1.5">
                  {replyLoading ? 'Posting…' : hasReply ? 'Update' : 'Post reply'}
                </button>
              </div>
            </div>
            {replyError && <p className="text-xs text-rose-400">{replyError}</p>}
          </motion.form>
        )}
      </AnimatePresence>

      {!hasReply && !isSeller && (
        <p className="text-xs text-zinc-700 mt-2 italic">Awaiting seller's answer…</p>
      )}
    </motion.div>
  );
};

const ReviewSection = ({ productId, avgRating = 0, reviewCount = 0, sellerId }) => {
  const { user } = useAuth();
  const isSeller = user && (user._id === sellerId || user.id === sellerId);
  const [reviews, setReviews]       = useState([]);
  const [breakdown, setBreakdown]   = useState({ 5:0, 4:0, 3:0, 2:0, 1:0 });
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [sort, setSort]             = useState('newest');
  const [starFilter, setStarFilter] = useState('');
  const [page, setPage]             = useState(1);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 8, sort };
      if (starFilter) params.stars = starFilter;
      const { data } = await reviewApi.getForProduct(productId, params);
      setReviews(data.data.reviews); setBreakdown(data.data.ratingBreakdown); setPagination(data.data.pagination);
    } finally { setLoading(false); }
  }, [productId, page, sort, starFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleReplySubmitted = (reviewId, newReply) => {
    setReviews(p => p.map(r => r._id === reviewId ? { ...r, sellerReply: newReply } : r));
  };

  if (reviewCount === 0) return (
    <div className="py-8 text-center">
      <p className="text-2xl mb-2"></p>
      <p className="text-zinc-600 text-sm">No reviews yet. Be the first!</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="text-center shrink-0">
          <p className="text-6xl font-black text-zinc-100 leading-none">{avgRating.toFixed(1)}</p>
          <div className="mt-2 flex justify-center"><StarRating value={avgRating} readonly size="sm" /></div>
          <p className="text-xs text-zinc-600 mt-1">{reviewCount.toLocaleString()} review{reviewCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 w-full space-y-2">
          {[5,4,3,2,1].map(star => (
            <BreakdownBar key={star} star={star} count={breakdown[star] || 0} total={reviewCount}
              active={!starFilter || starFilter === String(star)}
              onClick={() => { setStarFilter(starFilter === String(star) ? '' : String(star)); setPage(1); }} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          {starFilter && (
            <button onClick={() => { setStarFilter(''); setPage(1); }}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 font-medium">
               {starFilter} only
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
          className="bg-surface-3 border border-white/8 text-zinc-400 text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-violet-500/40">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
        </select>
      </div>

      {/* Reviews */}
      <div className="card rounded-2xl px-6">
        {loading ? (
          <div className="space-y-4 py-4 animate-pulse">
            {[1,2,3].map(i => (
              <div key={i} className="space-y-2 py-4 border-b border-white/5">
                <div className="flex gap-3"><div className="w-9 h-9 rounded-full bg-surface-3" /><div className="flex-1 space-y-2"><div className="h-3 bg-surface-3 rounded w-1/4" /><div className="h-3 bg-surface-3 rounded w-1/3" /></div></div>
                <div className="h-12 bg-surface-3 rounded" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-600">No reviews match this filter.</div>
        ) : (
          reviews.map(review => (
            <ReviewCard key={review._id} review={review} isSeller={isSeller} onReplySubmitted={handleReplySubmitted} />
          ))
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={!pagination.hasPrev}
            className="btn-secondary text-sm px-4 py-2 disabled:opacity-30">← Previous</button>
          <span className="px-4 py-2 text-sm text-zinc-600">{pagination.page} / {pagination.pages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.pages, p+1))} disabled={!pagination.hasNext}
            className="btn-secondary text-sm px-4 py-2 disabled:opacity-30">Next →</button>
        </div>
      )}
    </div>
  );
};

export default ReviewSection;
