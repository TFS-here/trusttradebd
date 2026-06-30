const StockBadge = ({ stock, showCount = false, size = 'md' }) => {
  const isOut  = stock === 0;
  const isLow  = stock > 0 && stock <= 5;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  const base = `inline-flex items-center gap-1.5 rounded-full font-semibold ${sizeClass}`;

  if (isOut) return (
    <span className={`${base} bg-rose-500/15 text-rose-400 border border-rose-500/20`}>
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
      Out of Stock
    </span>
  );
  if (isLow) return (
    <span className={`${base} bg-amber-400/15 text-amber-400 border border-amber-400/20`}>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
      {showCount ? `Only ${stock} left` : 'Low Stock'}
    </span>
  );
  return (
    <span className={`${base} bg-emerald-400/15 text-emerald-400 border border-emerald-400/20`}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
      {showCount ? `${stock} in stock` : 'In Stock'}
    </span>
  );
};

export default StockBadge;
