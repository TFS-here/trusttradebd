import { Lightbulb, PartyPopper, Lock } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { walletApi } from '../../api/orderApi';

const TX_CONFIG = {
  DEPOSIT:       { label: 'Deposit',          color: 'emerald', sign: '+' },
  WITHDRAWAL:    { label: 'Withdrawal',        color: 'rose',    sign: '−' },
  ORDER_LOCK:    { label: 'Escrow lock',       color: 'amber',   sign: '−' },
  ORDER_RELEASE: { label: 'Payment received',  color: 'emerald', sign: '+' },
  REFUND:        { label: 'Refund',            color: 'violet',  sign: '+' },
  FEE:           { label: 'Platform fee',      color: 'zinc',    sign: '−' },
};

const BADGE = {
  emerald: 'badge-emerald',
  rose:    'badge-rose',
  amber:   'badge-amber',
  violet:  'badge-violet',
  zinc:    'badge-zinc',
};

const SIGN_COLOR = { '+': 'text-emerald-400', '−': 'text-rose-400' };

// ── Deposit form ──────────────────────────────────────────────────
const DepositForm = ({ onSuccess }) => {
  const QUICK = [500, 1000, 2000, 5000];
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n < 10)  { setError('Minimum deposit is ৳10.'); return; }
    if (n > 100_000)                     { setError('Maximum deposit is ৳1,00,000.'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await walletApi.deposit(parseFloat(n.toFixed(2)));
      if (data.data && data.data.GatewayPageURL) {
        window.location.href = data.data.GatewayPageURL;
      } else {
        // Fallback or local bypass
        onSuccess(data.data.wallet, n, 'deposit');
        setAmount('');
        setLoading(false);
      }
    } catch (err) { 
      setError(err.response?.data?.message || 'Deposit failed.'); 
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {QUICK.map(q => (
          <button key={q} onClick={() => setAmount(String(q))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                        ${amount === String(q)
                          ? 'bg-violet-500/20 text-violet-400 border-violet-500/40'
                          : 'bg-surface-2 text-zinc-500 border-white/8 hover:border-violet-500/30 hover:text-zinc-300'}`}>
            ৳{q.toLocaleString('en-BD')}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 font-medium text-sm">৳</span>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="Enter amount" min="10" max="100000"
            className="input pl-8" onKeyDown={e => e.key === 'Enter' && handle()} />
        </div>
        <button onClick={handle} disabled={loading || !amount} className="btn-primary px-5 shrink-0">
          {loading ? 'Adding…' : 'Add Funds'}
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
};

// ── Withdraw form ─────────────────────────────────────────────────
const WithdrawForm = ({ availableBalance, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const shortcuts = [
    { label: '25%', val: Math.floor(availableBalance * 0.25) },
    { label: '50%', val: Math.floor(availableBalance * 0.5)  },
    { label: 'All', val: Math.floor(availableBalance)        },
  ].filter(s => s.val > 0);

  const handle = async () => {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0)  { setError('Enter a valid amount.'); return; }
    if (n > availableBalance)            { setError(`Cannot exceed ৳${availableBalance.toLocaleString('en-BD')}.`); return; }
    setLoading(true); setError('');
    try {
      const { data } = await walletApi.withdraw(parseFloat(n.toFixed(2)));
      onSuccess(data.data.wallet, n, 'withdraw');
      setAmount('');
    } catch (err) { setError(err.response?.data?.message || 'Withdrawal failed.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      {shortcuts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {shortcuts.map(s => (
            <button key={s.label} onClick={() => setAmount(String(s.val))}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                          ${amount === String(s.val)
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-surface-2 text-zinc-500 border-white/8 hover:border-rose-500/30 hover:text-zinc-300'}`}>
              {s.label} · ৳{s.val.toLocaleString('en-BD')}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 font-medium text-sm">৳</span>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder={`Max ৳${availableBalance.toLocaleString('en-BD')}`}
            min="1" max={availableBalance}
            className="input pl-8" onKeyDown={e => e.key === 'Enter' && handle()} />
        </div>
        <button onClick={handle} disabled={loading || !amount || availableBalance <= 0}
          className="btn-danger px-5 shrink-0">
          {loading ? 'Processing…' : 'Withdraw'}
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <p className="text-xs text-zinc-700"><Lightbulb className="inline w-5 h-5 mr-1 align-text-bottom" /> In a real system this transfers to your bank/bKash account.</p>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────
const WalletPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [wallet, setWallet]     = useState(null);
  const [transactions, setTx]   = useState([]);
  const [txPagination, setTxPg] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [txLoading, setTxLoad]  = useState(false);
  const [activeTab, setTab]     = useState(''); // '' | 'deposit' | 'withdraw'
  const [flash, setFlash]       = useState(null);
  const [txFilter, setTxFilter] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Check for SSLCommerz return parameters
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      setShowSuccessModal(true);
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    } else if (paymentStatus === 'failed') {
      setFlash({ msg: 'Payment failed or was cancelled.', type: 'withdraw' }); // uses rose color
      setTimeout(() => setFlash(null), 5000);
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchWallet = useCallback(async () => {
    try { const { data } = await walletApi.getBalance(); setWallet(data.data.wallet); }
    finally { setLoading(false); }
  }, []);

  const fetchTx = useCallback(async (page = 1) => {
    setTxLoad(true);
    try {
      const { data } = await walletApi.getTransactions({ page, limit: 15, ...(txFilter ? { type: txFilter } : {}) });
      setTx(data.data.transactions); setTxPg(data.data.pagination);
    } finally { setTxLoad(false); }
  }, [txFilter]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);
  useEffect(() => { fetchTx(); }, [fetchTx]);

  const handleSuccess = (newWallet, amount, kind) => {
    setWallet(newWallet); setTab('');
    setFlash({ msg: kind === 'deposit' ? `৳${amount.toLocaleString('en-BD')} added to your wallet!` : `৳${amount.toLocaleString('en-BD')} withdrawn successfully!`, type: kind });
    fetchTx();
    setTimeout(() => setFlash(null), 4000);
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-4 animate-pulse">
      <div className="h-48 bg-surface-2 rounded-2xl" />
      <div className="h-64 bg-surface-2 rounded-2xl" />
    </div>
  );

  const available = wallet?.availableBalance ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 relative">
      
      {/* ── Congratulation Modal Overlay ── */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm rounded-3xl p-8 overflow-hidden text-center"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(17,17,19,1) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              {/* Confetti particles */}
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-emerald-400"
                  initial={{ top: '100%', left: `${Math.random() * 100}%`, scale: 0, rotate: 0, opacity: 1 }}
                  animate={{
                    top: `${Math.random() * 100}%`,
                    scale: Math.random() * 1.5 + 0.5,
                    rotate: Math.random() * 360,
                    opacity: 0,
                  }}
                  transition={{ duration: 1.5 + Math.random() * 2, ease: "easeOut", delay: Math.random() * 0.5 }}
                />
              ))}

              <div className="flex justify-center mb-5 relative z-10">
                <motion.div 
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                >
                  <PartyPopper className="inline w-5 h-5 mr-1 align-text-bottom" />
                </motion.div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 relative z-10">Congratulations!</h2>
              <p className="text-zinc-400 text-sm mb-6 relative z-10 leading-relaxed">
                Your payment was successful and the funds have been safely added to your wallet.
              </p>
              <button 
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-colors relative z-10"
              >
                Awesome!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <p className="section-label mb-1">Finance</p>
        <h1 className="text-2xl font-bold text-zinc-100">My Wallet</h1>
      </div>

      {/* Balance card */}
      <div className="relative rounded-2xl overflow-hidden p-6 text-white"
           style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.8) 0%, rgba(109,40,217,0.5) 50%, rgba(17,17,19,1) 100%)' }}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-violet-400/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />

        <p className="text-violet-200 text-sm font-medium mb-1 relative z-10">Available Balance</p>
        <p className="text-4xl font-extrabold tracking-tight relative z-10">
          ৳{available.toLocaleString('en-BD')}
        </p>

        {wallet?.escrowBalance > 0 && (
          <div className="mt-3 pt-3 border-t border-violet-400/20 flex items-center gap-2 relative z-10">
            <span className="text-violet-300 text-xs"><Lock className="inline w-5 h-5 mr-1 align-text-bottom" /> In escrow:</span>
            <span className="text-white font-semibold text-sm">৳{wallet.escrowBalance.toLocaleString('en-BD')}</span>
          </div>
        )}

        <div className="mt-5 flex gap-3 relative z-10">
          <button onClick={() => setTab(activeTab === 'deposit' ? '' : 'deposit')}
            className={`flex-1 flex items-center justify-center gap-2 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all
                        ${activeTab === 'deposit' ? 'bg-white text-violet-700' : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Money
          </button>
          <button onClick={() => setTab(activeTab === 'withdraw' ? '' : 'withdraw')}
            disabled={available <= 0}
            className={`flex-1 flex items-center justify-center gap-2 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all
                        ${activeTab === 'withdraw' ? 'bg-white text-rose-600' : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4m8 8l-8-8 8-8" />
            </svg>
            Withdraw
          </button>
        </div>
      </div>

      {/* Flash */}
      <AnimatePresence>
        {flash && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium border
                        ${flash.type === 'deposit'
                          ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {flash.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forms */}
      <AnimatePresence>
        {activeTab && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card rounded-2xl p-5">
              <h3 className="font-semibold text-zinc-200 mb-4">
                {activeTab === 'deposit' ? ' Add Money' : ' Withdraw Money'}
              </h3>
              {activeTab === 'deposit'
                ? <DepositForm onSuccess={handleSuccess} />
                : <WithdrawForm availableBalance={available} onSuccess={handleSuccess} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transactions */}
      <div className="card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <p className="font-semibold text-zinc-200">Transactions</p>
          <select value={txFilter} onChange={e => setTxFilter(e.target.value)}
            className="bg-surface-3 border border-white/8 text-zinc-400 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500/40">
            <option value="">All types</option>
            {Object.entries(TX_CONFIG).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>

        {txLoading && <div className="p-6 space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-14 bg-surface-2 rounded-xl" />)}</div>}
        {!txLoading && transactions.length === 0 && <div className="py-12 text-center text-zinc-600 text-sm">No transactions yet.</div>}
        {!txLoading && transactions.length > 0 && (
          <div className="divide-y divide-white/5">
            {transactions.map(tx => {
              const cfg = TX_CONFIG[tx.type] || { label: tx.type, color: 'zinc', sign: '' };
              return (
                <div key={tx._id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition">
                  <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${BADGE[cfg.color] || BADGE.zinc}`}>
                    {cfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{tx.description || cfg.label}</p>
                    <p className="text-xs text-zinc-600">
                      {new Date(tx.createdAt).toLocaleString('en-BD', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold text-sm ${SIGN_COLOR[cfg.sign] || 'text-zinc-400'}`}>
                      {cfg.sign}৳{tx.amount.toLocaleString('en-BD')}
                    </p>
                    <p className="text-xs text-zinc-600">Bal: ৳{tx.balanceAfter.toLocaleString('en-BD')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {txPagination && txPagination.pages > 1 && (
          <div className="flex justify-center gap-2 px-5 py-4 border-t border-white/5">
            {Array.from({ length: txPagination.pages }, (_, i) => i+1).map(p => (
              <button key={p} onClick={() => fetchTx(p)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition
                            ${p === txPagination.page ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-zinc-600 hover:bg-surface-2'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPanel;
