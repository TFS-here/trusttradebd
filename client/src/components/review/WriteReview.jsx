import { Pencil } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { reviewApi } from '../../api/reviewApi';
import { useAuth } from '../../context/AuthContext';
import StarRating from './StarRating';

const WriteReview = ({ orderId, productId, onSubmitted }) => {
  const { user } = useAuth();
  const [resolvedOrderId, setResolvedOrderId] = useState(orderId || null);
  const [eligibility, setEligibility] = useState(null);
  const [rating, setRating]           = useState(0);
  const [comment, setComment]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [submitted, setSubmitted]     = useState(false);
  const [open, setOpen]               = useState(!!orderId);

  useEffect(() => {
    if (!user || user.role !== 'buyer') { setEligibility({ eligible: false, reason: 'login' }); return; }
    if (orderId) {
      reviewApi.checkEligibility(orderId)
        .then(({ data }) => setEligibility(data.data))
        .catch(() => setEligibility({ eligible: false, reason: 'error' }));
    } else if (productId) {
      reviewApi.canReview(productId)
        .then(({ data }) => {
          if (data.data.canReview) { setResolvedOrderId(data.data.orderId); setEligibility({ eligible: true }); }
          else setEligibility({ eligible: false, reason: data.data.reason });
        })
        .catch(() => setEligibility({ eligible: false, reason: 'error' }));
    }
  }, [orderId, productId, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) { setError('Please select a star rating.'); return; }
    if (comment.trim().length < 10) { setError('Review must be at least 10 characters.'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await reviewApi.create({ orderId: resolvedOrderId, rating, comment: comment.trim() });
      setSubmitted(true); onSubmitted?.(data.data.review);
    } catch (err) { setError(err.response?.data?.message || 'Failed to submit. Please try again.'); }
    finally { setLoading(false); }
  };

  if (eligibility === null) return null;

  if (eligibility.reason === 'login' && productId) return (
    <div className="bg-surface-2 border border-white/8 rounded-2xl px-5 py-4 text-sm text-zinc-500">
      <a href="/login" className="text-violet-400 font-medium hover:text-violet-300">Sign in</a>
      {' '}to leave a review after purchasing this product.
    </div>
  );

  if (!eligibility.eligible && orderId) return null;

  if (!eligibility.eligible && productId) return (
    <div className="bg-amber-400/8 border border-amber-400/15 rounded-2xl px-5 py-4 flex items-start gap-3">
      <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <p className="text-sm font-semibold text-amber-400">Verified purchase required</p>
        <p className="text-xs text-amber-400/60 mt-0.5">Only buyers who have received this product can leave a review.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-emerald-400/10 border border-emerald-400/20 rounded-2xl px-5 py-4 flex items-center gap-3">
      <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      <p className="text-sm font-medium text-emerald-400">Your review has been published. Thank you!</p>
    </motion.div>
  );

  const MAX = 1000;

  if (productId && !open) return (
    <motion.button initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => setOpen(true)}
      className="w-full flex items-center justify-center gap-2 py-3 px-5
                 bg-amber-400/8 border-2 border-dashed border-amber-400/20 rounded-2xl
                 text-amber-400 font-semibold text-sm hover:bg-amber-400/12 hover:border-amber-400/30 transition-all">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
      <Pencil className="inline w-5 h-5 mr-1 align-text-bottom" /> Write a Review — You purchased this product
    </motion.button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="card rounded-2xl border-amber-400/20 p-6" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-zinc-100 text-lg">Write a Review</h3>
          <p className="text-xs text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Verified purchase
          </p>
        </div>
        {productId && (
          <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-400 transition p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Your rating <span className="text-rose-400">*</span>
          </label>
          <StarRating value={rating} onChange={setRating} size="lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            Your review <span className="text-rose-400">*</span>
          </label>
          <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, MAX))}
            placeholder="What did you like or dislike? Was the product as described? How was the seller's communication?"
            rows={4} className={`input resize-none ${error ? 'border-rose-500/50 focus:ring-rose-500/20' : ''}`} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-zinc-600">Minimum 10 characters</span>
            <span className={`text-xs ${MAX - comment.length < 50 ? 'text-amber-400' : 'text-zinc-600'}`}>
              {MAX - comment.length} remaining
            </span>
          </div>
        </div>
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <button type="submit" disabled={loading || rating === 0} className="btn-primary w-full py-3 disabled:opacity-50">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Publishing…
            </span>
          ) : 'Publish Review'}
        </button>
      </form>
    </motion.div>
  );
};

export default WriteReview;
