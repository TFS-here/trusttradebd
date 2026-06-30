import { useState } from 'react';

const SIZES = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-7 h-7' };
const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

const Star = ({ filled, className }) => (
  <svg viewBox="0 0 20 20" className={className} style={{ display: 'block' }}>
    <path fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={filled ? 0 : 1.5}
      d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const StarRating = ({ value = 0, onChange, size = 'md', readonly = false, showValue = false, count }) => {
  const [hovered, setHovered] = useState(0);
  const display = readonly ? value : (hovered || value);
  const sizeClass = SIZES[size] || SIZES.md;

  if (readonly) return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(s => (
          <span key={s} className={display >= s ? 'text-amber-400' : 'text-zinc-700'}>
            <Star filled={display >= s} className={sizeClass} />
          </span>
        ))}
      </div>
      {showValue && value > 0 && <span className="text-sm font-semibold text-zinc-300">{value.toFixed(1)}</span>}
      {count !== undefined && count > 0 && <span className="text-sm text-zinc-600">({count.toLocaleString()})</span>}
    </div>
  );

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)} role="radiogroup">
        {[1,2,3,4,5].map(s => (
          <button key={s} type="button" role="radio" aria-checked={value === s}
            aria-label={`${s} stars: ${LABELS[s]}`}
            onClick={() => onChange?.(s)} onMouseEnter={() => setHovered(s)}
            className={`transition-transform hover:scale-110 focus-visible:outline-none rounded
                        ${hovered >= s || value >= s ? 'text-amber-400' : 'text-zinc-700'}`}>
            <Star filled className={sizeClass} />
          </button>
        ))}
      </div>
      {(hovered > 0 || value > 0) && (
        <p className="text-xs text-amber-400 font-medium h-4">{LABELS[hovered || value]}</p>
      )}
    </div>
  );
};

export default StarRating;
