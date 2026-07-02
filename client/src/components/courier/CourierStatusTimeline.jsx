import { motion } from 'framer-motion';

// The ordered steps of a Pathao delivery lifecycle
const COURIER_STEPS = [
  { key: 'Pickup Requested', label: 'Pickup Requested',   icon: '📦' },
  { key: 'In Transit',       label: 'In Transit',         icon: '🚚' },
  { key: 'Delivered',        label: 'Delivered',          icon: '✅' },
];

// Non-standard / return statuses shown as a separate warning badge
const RETURN_STATUSES = ['Returning', 'Returned to Seller', 'Partial Delivery'];

/**
 * CourierStatusTimeline
 * ─────────────────────────────────────────────────────────────────
 * Renders a visual step-by-step courier progress tracker.
 * Driven by courierStatus (latest) and courierStatusHistory (audit trail).
 */
const CourierStatusTimeline = ({ courierStatus, courierStatusHistory = [] }) => {
  if (!courierStatus && courierStatusHistory.length === 0) {
    return null;
  }

  const isReturnStatus = RETURN_STATUSES.includes(courierStatus);

  // Find active step index
  const activeIndex = COURIER_STEPS.findIndex(s => s.key === courierStatus);

  return (
    <div className="card rounded-2xl px-5 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-red-500/10 text-red-400 text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide">
            PATHAO
          </span>
          <p className="text-sm font-semibold text-zinc-200">Courier Status</p>
        </div>
        {courierStatus && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
            ${courierStatus === 'Delivered'
              ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
              : isReturnStatus
              ? 'bg-rose-400/10 text-rose-400 border border-rose-400/20'
              : 'bg-violet-400/10 text-violet-400 border border-violet-400/20'
            }`}>
            {courierStatus}
          </span>
        )}
      </div>

      {/* Return warning */}
      {isReturnStatus && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm text-rose-400">
          ⚠️ This parcel is being returned to the seller. Please contact support.
        </div>
      )}

      {/* Step tracker */}
      {!isReturnStatus && (
        <div className="relative flex items-start justify-between gap-1 mt-1">
          {/* Connecting line */}
          <div className="absolute top-5 left-5 right-5 h-0.5 bg-white/5" />
          <motion.div
            className="absolute top-5 left-5 h-0.5 bg-violet-500"
            initial={{ width: 0 }}
            animate={{
              width: activeIndex < 0 ? '0%'
                : activeIndex === 0 ? '0%'
                : activeIndex === 1 ? '50%'
                : '100%'
            }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />

          {COURIER_STEPS.map((step, i) => {
            const isDone    = activeIndex > i;
            const isActive  = activeIndex === i;
            return (
              <div key={step.key} className="flex flex-col items-center gap-2 z-10 flex-1">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-base transition-all
                    ${isDone    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                    : isActive  ? 'bg-violet-500/20 border-2 border-violet-500 text-violet-400 shadow-lg shadow-violet-500/20'
                    : 'bg-surface-2 border-2 border-white/10 text-zinc-600'}`}
                >
                  {isDone ? '✓' : step.icon}
                </motion.div>
                <p className={`text-xs text-center font-medium leading-tight
                  ${isDone ? 'text-emerald-400' : isActive ? 'text-violet-400' : 'text-zinc-600'}`}>
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* History timeline */}
      {courierStatusHistory.length > 1 && (
        <details className="group mt-2">
          <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 transition select-none">
            View full history ({courierStatusHistory.length} events) ▾
          </summary>
          <div className="mt-3 space-y-2">
            {[...courierStatusHistory].reverse().map((event, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500/50 mt-1.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-300">{event.status}</p>
                  <p className="text-xs text-zinc-600">
                    {new Date(event.timestamp).toLocaleString('en-BD', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default CourierStatusTimeline;
