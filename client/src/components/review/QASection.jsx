import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { qaApi } from '../../api/qaApi';
import { useAuth } from '../../context/AuthContext';

const AskInput = ({ onSubmit, loading }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const MAX = 500;
  const handle = async (e) => {
    e.preventDefault();
    if (text.trim().length < 5) { setError('Question must be at least 5 characters.'); return; }
    setError('');
    const ok = await onSubmit(text.trim());
    if (ok) setText('');
  };
  return (
    <form onSubmit={handle} className="space-y-2">
      <textarea value={text} onChange={e => setText(e.target.value.slice(0, MAX))}
        placeholder="Ask a question about this product…" rows={3} className="input resize-none" />
      <div className="flex items-center justify-between">
        <div>
          {error ? <p className="text-xs text-rose-400">{error}</p>
            : <p className="text-xs text-zinc-600">{MAX - text.length} characters remaining</p>}
        </div>
        <button type="submit" disabled={loading || text.trim().length < 5} className="btn-primary text-xs px-4 py-2">
          {loading ? 'Posting…' : 'Post Question'}
        </button>
      </div>
    </form>
  );
};

const AnswerInput = ({ questionId, existing, onAnswered, onCancel }) => {
  const [text, setText]     = useState(existing || '');
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState('');
  const handle = async (e) => {
    e.preventDefault();
    if (text.trim().length < 2) { setError('Answer cannot be empty.'); return; }
    setLoad(true); setError('');
    try {
      const { data } = await qaApi.answer(questionId, text.trim());
      onAnswered(data.data.question);
    } catch (err) { setError(err.response?.data?.message || 'Failed.'); }
    finally { setLoad(false); }
  };
  return (
    <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }} onSubmit={handle}
      className="overflow-hidden mt-3 ml-4 pl-4 border-l-2 border-emerald-400/20 space-y-2">
      <textarea autoFocus value={text} onChange={e => setText(e.target.value.slice(0, 1000))}
        placeholder="Write your answer…" rows={3} className="input resize-none" />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost text-xs px-3 py-1.5">Cancel</button>
        <button type="submit" disabled={loading} className="btn-emerald text-xs px-3 py-1.5">
          {loading ? 'Posting…' : existing ? 'Update answer' : 'Post answer'}
        </button>
      </div>
    </motion.form>
  );
};

const QuestionCard = ({ q, isSeller, currentUserId, onUpdate, onDelete }) => {
  const [answerOpen, setAnswerOpen] = useState(false);
  const hasAnswer  = !!q.answer?.text;
  const isMyQ      = q.askedBy?._id === currentUserId || q.askedBy === currentUserId;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="py-4 border-b border-white/5 last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-sm font-semibold text-zinc-200">{q.askedBy?.name || q.askerName || 'Anonymous'}</span>
              <span className="text-xs text-zinc-600 ml-2">
                {new Date(q.createdAt).toLocaleDateString('en-BD', { day:'numeric', month:'short', year:'numeric' })}
              </span>
            </div>
            {(isMyQ || isSeller) && (
              <button onClick={() => onDelete(q._id)} className="text-xs text-zinc-700 hover:text-rose-400 transition shrink-0">✕</button>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{q.question}</p>
        </div>
      </div>

      {hasAnswer && (
        <div className="mt-3 ml-11 pl-4 border-l-2 border-emerald-400/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">Seller Answer</span>
            <span className="text-xs text-zinc-600">
              {new Date(q.answer.answeredAt).toLocaleDateString('en-BD', { day:'numeric', month:'short' })}
            </span>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">{q.answer.text}</p>
          {isSeller && <button onClick={() => setAnswerOpen(v => !v)} className="text-xs text-zinc-600 hover:text-violet-400 mt-1 transition">Edit answer</button>}
        </div>
      )}

      {isSeller && !hasAnswer && !answerOpen && (
        <button onClick={() => setAnswerOpen(true)}
          className="mt-2 ml-11 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Answer this question
        </button>
      )}

      <AnimatePresence>
        {answerOpen && (
          <AnswerInput questionId={q._id} existing={q.answer?.text}
            onAnswered={updated => { onUpdate(updated); setAnswerOpen(false); }}
            onCancel={() => setAnswerOpen(false)} />
        )}
      </AnimatePresence>

      {!hasAnswer && !isSeller && (
        <p className="text-xs text-zinc-700 mt-2 ml-11 italic">Awaiting seller's answer…</p>
      )}
    </motion.div>
  );
};

const QASection = ({ productId, sellerId }) => {
  const { user } = useAuth();
  const isSeller = user && (user._id === sellerId || user.id === sellerId);
  const [questions, setQuestions]   = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [asking, setAsking]         = useState(false);
  const [showAsk, setShowAsk]       = useState(false);
  const [page, setPage]             = useState(1);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await qaApi.getForProduct(productId, { page, limit: 10 });
      setQuestions(data.data.questions); setPagination(data.data.pagination);
    } finally { setLoading(false); }
  }, [productId, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAsk = async (text) => {
    setAsking(true);
    try {
      const { data } = await qaApi.ask(productId, text);
      setQuestions(p => [data.data.question, ...p]); setShowAsk(false); return true;
    } catch { return false; }
    finally { setAsking(false); }
  };

  const handleUpdate = updated => setQuestions(p => p.map(q => q._id === updated._id ? updated : q));
  const handleDelete = async (id) => {
    try { await qaApi.delete(id); setQuestions(p => p.filter(q => q._id !== id)); } catch {}
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-zinc-100 text-lg">
          Questions & Answers
          {pagination?.total > 0 && <span className="ml-2 text-sm font-normal text-zinc-600">({pagination.total})</span>}
        </h3>
        {user && !isSeller && (
          <button onClick={() => setShowAsk(v => !v)}
            className={`text-sm font-medium px-4 py-2 rounded-xl transition ${showAsk ? 'btn-secondary' : 'btn-primary'}`}>
            {showAsk ? 'Cancel' : '+ Ask a Question'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAsk && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-violet-500/8 border border-violet-500/20 rounded-2xl p-5">
              <p className="text-sm font-medium text-violet-400 mb-3">Your question will be answered by the seller</p>
              <AskInput onSubmit={handleAsk} loading={asking} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!user && (
        <div className="bg-surface-2 border border-white/8 rounded-xl px-4 py-3 text-sm text-zinc-600">
          <a href="/login" className="text-violet-400 font-medium hover:text-violet-300">Sign in</a>
          {' '}to ask a question about this product.
        </div>
      )}

      <div className="card rounded-2xl px-5">
        {loading ? (
          <div className="py-6 space-y-4 animate-pulse">
            {[1,2].map(i => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-3 shrink-0" />
                <div className="flex-1 space-y-2"><div className="h-3 bg-surface-3 rounded w-1/4" /><div className="h-10 bg-surface-3 rounded" /></div>
              </div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">💬</p>
            <p className="text-zinc-600 text-sm">No questions yet. Be the first to ask!</p>
          </div>
        ) : (
          questions.map(q => (
            <QuestionCard key={q._id} q={q} isSeller={isSeller}
              currentUserId={user?._id || user?.id}
              onUpdate={handleUpdate} onDelete={handleDelete} />
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

export default QASection;
