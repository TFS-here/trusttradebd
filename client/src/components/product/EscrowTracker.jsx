import { motion } from 'framer-motion';

const MAIN_STEPS = [
  { key: 'LOCKED',    label: 'Order Placed',      sublabel: r => r==='seller' ? 'Prepare to ship' : 'Funds secured in escrow',   icon: '🔒' },
  { key: 'SHIPPED',   label: 'Shipped',            sublabel: r => r==='seller' ? 'Tracking shared' : 'Your order is on its way',   icon: '📦' },
  { key: 'DELIVERED', label: 'Delivered',          sublabel: () => 'Buyer confirmed receipt',                                      icon: '✅' },
  { key: 'RELEASED',  label: 'Payment Released',   sublabel: r => r==='seller' ? 'Funds in your wallet' : 'Transaction complete',  icon: '💳' },
];

const EXCEPTION = {
  ON_HOLD:  { label: 'Dispute / On Hold', color: 'amber',   icon: '⚠️' },
  REFUNDED: { label: 'Refunded',          color: 'rose',    icon: '↩️' },
};

const stepIndex = s => MAIN_STEPS.findIndex(x => x.key === s);

const EscrowTracker = ({ status, escrowHistory = [], role = 'buyer' }) => {
  const isException   = status === 'ON_HOLD' || status === 'REFUNDED';
  const currentIndex  = isException ? -1 : stepIndex(status);

  const getTimestamp = (key) => {
    const event = [...escrowHistory].reverse().find(e => e.to === key);
    if (!event) return null;
    return new Date(event.timestamp).toLocaleString('en-BD', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  };

  const exColors = { amber: { bg: 'bg-amber-400/10', border: 'border-amber-400/20', text: 'text-amber-400' }, rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400' } };

  return (
    <div className="card rounded-2xl p-6">
      <p className="section-label mb-6">Escrow Status</p>

      {isException && (() => {
        const ex = EXCEPTION[status];
        const c  = exColors[ex.color];
        return (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className={`mb-6 flex items-center gap-3 rounded-xl px-4 py-3 border ${c.bg} ${c.border}`}>
            <span className="text-xl">{ex.icon}</span>
            <div>
              <p className={`font-semibold text-sm ${c.text}`}>{ex.label}</p>
              {status === 'ON_HOLD' && <p className="text-xs text-zinc-500 mt-0.5">Admin is reviewing. No action needed.</p>}
              {status === 'REFUNDED' && <p className="text-xs text-zinc-500 mt-0.5">Funds returned to buyer's wallet.</p>}
            </div>
          </motion.div>
        );
      })()}

      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-5 top-5 bottom-5 w-px bg-white/5" />

        <div className="space-y-1">
          {MAIN_STEPS.map((step, i) => {
            const isDone    = !isException && i < currentIndex;
            const isCurrent = !isException && i === currentIndex;
            const isFuture  = isException || i > currentIndex;
            const ts = getTimestamp(step.key);

            return (
              <motion.div key={step.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }} className="flex items-start gap-4 relative">

                {/* Step circle */}
                <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 transition-all
                                  ${isCurrent ? 'bg-violet-500/20 border-2 border-violet-500/60'
                                    : isDone   ? 'bg-emerald-400/20 border border-emerald-400/30'
                                    :            'bg-surface-2 border border-white/8'}`}>
                  {isDone ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={isFuture ? 'opacity-30 grayscale' : ''}>{step.icon}</span>
                  )}
                  {isCurrent && (
                    <span className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping" />
                  )}
                </div>

                {/* Content */}
                <div className={`pb-6 flex-1 min-w-0 ${isFuture ? 'opacity-30' : ''}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-sm font-semibold
                                   ${isCurrent ? 'text-violet-400' : isDone ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {step.label}
                    </p>
                    {ts && <span className="text-xs text-zinc-600 shrink-0">{ts}</span>}
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">{step.sublabel(role)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EscrowTracker;
