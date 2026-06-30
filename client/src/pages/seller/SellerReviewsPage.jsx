import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { reviewApi } from '../../api/reviewApi';
import { qaApi } from '../../api/qaApi';
import { useAuth } from '../../context/AuthContext';
import StarRating from '../../components/review/StarRating';

// ── Pending Q&A panel ─────────────────────────────────────────────
const AnswerTextarea = ({ qId, answers, setAnswers }) => (
  <textarea
    value={answers[qId] || ''}
    onChange={e => setAnswers(p => ({ ...p, [qId]: e.target.value }))}
    placeholder="Write your answer…"
    rows={2}
    className="input resize-none"
  />
);

const PendingQA = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [answers, setAnswers]     = useState({});
  const [posting, setPosting]     = useState({});
  const [errors, setErrors]       = useState({});

  useEffect(() => {
    qaApi.getPendingForSeller()
      .then(({ data }) => setQuestions(data.data.questions))
      .finally(() => setLoading(false));
  }, []);

  const handleAnswer = async (qId) => {
    const text = answers[qId] || '';
    if (!text.trim()) { setErrors(p => ({ ...p, [qId]: 'Answer cannot be empty.' })); return; }
    setPosting(p => ({ ...p, [qId]: true })); setErrors(p => ({ ...p, [qId]: '' }));
    try {
      await qaApi.answer(qId, text.trim());
      setQuestions(p => p.filter(q => q._id !== qId));
    } catch (err) { setErrors(p => ({ ...p, [qId]: err.response?.data?.message || 'Failed.' })); }
    finally { setPosting(p => ({ ...p, [qId]: false })); }
  };

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-24 bg-surface-2 rounded-2xl" />)}
    </div>
  );

  if (questions.length === 0) return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-white/5 flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
      <p className="font-semibold text-zinc-400">All questions answered!</p>
      <p className="text-sm text-zinc-600 mt-1">New questions from buyers will appear here.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {questions.map(q => (
        <div key={q._id} className="card rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-zinc-200">{q.askedBy?.name || 'Anonymous'}</span>
                <span className="text-xs text-zinc-600">
                  {new Date(q.createdAt).toLocaleDateString('en-BD', { day:'numeric', month:'short', year:'numeric' })}
                </span>
              </div>
              <p className="text-sm text-zinc-400">{q.question}</p>
              {q.product && (
                <p className="text-xs text-violet-400 mt-1 truncate">📦 {q.product.title}</p>
              )}
            </div>
          </div>
          <div className="space-y-2 ml-11">
            <AnswerTextarea qId={q._id} answers={answers} setAnswers={setAnswers} />
            {errors[q._id] && <p className="text-xs text-rose-400">{errors[q._id]}</p>}
            <button onClick={() => handleAnswer(q._id)} disabled={posting[q._id]}
              className="btn-emerald text-xs px-4 py-2">
              {posting[q._id] ? 'Posting…' : 'Post Answer'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Reviews panel ─────────────────────────────────────────────────
const ReviewsPanel = ({ user }) => {
  const [reviews, setReviews]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [replyOpen, setReplyOpen]   = useState({});
  const [replyText, setReplyText]   = useState({});
  const [replyLoad, setReplyLoad]   = useState({});
  const [replyErrs, setReplyErrs]   = useState({});

  useEffect(() => {
    if (!user?._id) return;
    reviewApi.getForSeller(user._id, { limit: 20 })
      .then(({ data }) => setReviews(data.data.reviews))
      .finally(() => setLoading(false));
  }, [user]);

  const handleReply = async (reviewId) => {
    const text = replyText[reviewId] || '';
    if (!text.trim()) { setReplyErrs(p => ({ ...p, [reviewId]: 'Reply cannot be empty.' })); return; }
    setReplyLoad(p => ({ ...p, [reviewId]: true })); setReplyErrs(p => ({ ...p, [reviewId]: '' }));
    try {
      const { data } = await reviewApi.reply(reviewId, text.trim());
      setReviews(p => p.map(r => r._id === reviewId ? { ...r, sellerReply: data.data.review.sellerReply } : r));
      setReplyOpen(p => ({ ...p, [reviewId]: false }));
    } catch (err) { setReplyErrs(p => ({ ...p, [reviewId]: err.response?.data?.message || 'Failed.' })); }
    finally { setReplyLoad(p => ({ ...p, [reviewId]: false })); }
  };

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-28 bg-surface-2 rounded-2xl" />)}
    </div>
  );

  if (reviews.length === 0) return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-white/5 flex items-center justify-center text-3xl mx-auto mb-4">⭐</div>
      <p className="font-semibold text-zinc-400">No reviews yet</p>
      <p className="text-sm text-zinc-600 mt-1">Reviews will appear here once buyers rate your products.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {reviews.map(review => (
        <motion.div key={review._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="card rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <img src={review.reviewer?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.reviewer?.name||'U')}&background=7C3AED&color=fff&size=40`}
              alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-violet-500/20 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-zinc-200">{review.reviewer?.name}</p>
                  <p className="text-xs text-zinc-600">
                    {new Date(review.createdAt).toLocaleDateString('en-BD', { day:'numeric', month:'long', year:'numeric' })}
                  </p>
                </div>
                <StarRating value={review.rating} readonly size="sm" />
              </div>
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{review.comment}</p>
              {review.product && (
                <p className="text-xs text-violet-400 mt-1 truncate">📦 {review.product.title}</p>
              )}
            </div>
          </div>

          {/* Existing reply */}
          {review.sellerReply?.comment && (
            <div className="ml-13 pl-4 border-l-2 border-violet-500/20">
              <p className="text-xs font-semibold text-violet-400 mb-1">Your reply</p>
              <p className="text-sm text-zinc-400">{review.sellerReply.comment}</p>
              <button onClick={() => setReplyOpen(p => ({ ...p, [review._id]: !p[review._id] }))}
                className="text-xs text-zinc-600 hover:text-violet-400 mt-1 transition">Edit reply</button>
            </div>
          )}

          {/* Reply button */}
          {!review.sellerReply?.comment && !replyOpen[review._id] && (
            <button onClick={() => setReplyOpen(p => ({ ...p, [review._id]: true }))}
              className="text-xs font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1 transition ml-13">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Reply to this review
            </button>
          )}

          {/* Reply form */}
          <AnimatePresence>
            {replyOpen[review._id] && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden ml-13 pl-4 border-l-2 border-violet-500/20 space-y-2">
                <textarea autoFocus
                  value={replyText[review._id] || review.sellerReply?.comment || ''}
                  onChange={e => setReplyText(p => ({ ...p, [review._id]: e.target.value }))}
                  placeholder="Write a professional, helpful reply…"
                  rows={3} className="input resize-none" />
                {replyErrs[review._id] && <p className="text-xs text-rose-400">{replyErrs[review._id]}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setReplyOpen(p => ({ ...p, [review._id]: false }))}
                    className="btn-ghost text-xs px-3 py-1.5">Cancel</button>
                  <button onClick={() => handleReply(review._id)} disabled={replyLoad[review._id]}
                    className="btn-primary text-xs px-3 py-1.5">
                    {replyLoad[review._id] ? 'Posting…' : review.sellerReply?.comment ? 'Update' : 'Post reply'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────
const SellerReviewsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('reviews');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="section-label mb-1">Seller</p>
        <h1 className="text-2xl font-bold text-zinc-100">Reviews & Q&A</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-surface-2 border border-white/5 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${activeTab === 'reviews'
                        ? 'bg-surface-0 text-zinc-100 shadow-sm border border-white/8'
                        : 'text-zinc-600 hover:text-zinc-400'}`}>
          ⭐ Reviews
        </button>
        <button onClick={() => setActiveTab('qa')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${activeTab === 'qa'
                        ? 'bg-surface-0 text-zinc-100 shadow-sm border border-white/8'
                        : 'text-zinc-600 hover:text-zinc-400'}`}>
          💬 Pending Questions
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {activeTab === 'reviews' && <ReviewsPanel user={user} />}
          {activeTab === 'qa'      && <PendingQA />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SellerReviewsPage;
