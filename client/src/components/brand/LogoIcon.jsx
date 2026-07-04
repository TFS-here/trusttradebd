/**
 * TrustTradeBD — Premium Logo Component
 * 
 * A bold, luxurious logo featuring a custom "TT" monogram inside a
 * faceted shield shape with rich gradients and a subtle animated glow.
 *
 * Props:
 *   size  — 'sm' | 'md' | 'lg'  (default: 'md')
 */
const LogoIcon = ({ size = 'md' }) => {
  const dims = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-12 h-12' };
  const blur = { sm: 'blur-sm', md: 'blur-md', lg: 'blur-lg' };

  return (
    <div className={`relative ${dims[size]}`}>
      {/* Glow layer */}
      <div className={`absolute inset-0 rounded-2xl ${blur[size]} opacity-50
                        bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400
                        group-hover:opacity-80 transition-opacity duration-500`} />

      {/* Icon */}
      <svg className={`relative ${dims[size]} drop-shadow-lg`} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Definitions */}
        <defs>
          {/* Main shield gradient — deep violet to rich indigo */}
          <linearGradient id="shield-fill" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="50%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#4C1D95" />
          </linearGradient>

          {/* Gold accent gradient for the "TT" monogram */}
          <linearGradient id="monogram-fill" x1="20" y1="18" x2="44" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="50%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>

          {/* Subtle inner highlight */}
          <linearGradient id="highlight" x1="32" y1="4" x2="32" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="white" stopOpacity="0.25" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Shield shape — bold, slightly rounded, pointed bottom */}
        <path
          d="M32 3 C32 3, 8 10, 8 10 C8 10, 8 34, 8 34 C8 46, 18 56, 32 62 C46 56, 56 46, 56 34 C56 34, 56 10, 56 10 C56 10, 32 3, 32 3Z"
          fill="url(#shield-fill)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />

        {/* Inner highlight for depth */}
        <path
          d="M32 5 C32 5, 10 11.5, 10 11.5 C10 11.5, 10 34, 10 34 C10 45, 19.5 54.5, 32 60 C44.5 54.5, 54 45, 54 34 C54 34, 54 11.5, 54 11.5 C54 11.5, 32 5, 32 5Z"
          fill="url(#highlight)"
        />

        {/* "TT" Monogram — bold, geometric, interlocking */}
        {/* First T (left) */}
        <path
          d="M18 20 L30 20 L30 24 L26.5 24 L26.5 44 L21.5 44 L21.5 24 L18 24 Z"
          fill="url(#monogram-fill)"
        />
        {/* Second T (right, slightly overlapping) */}
        <path
          d="M30 20 L44 20 L44 24 L39.5 24 L39.5 44 L34.5 44 L34.5 24 L30 24 Z"
          fill="url(#monogram-fill)"
          opacity="0.85"
        />

        {/* Small diamond accent between the T's at bottom */}
        <path
          d="M30.5 42 L32 39 L33.5 42 L32 45 Z"
          fill="#FBBF24"
          opacity="0.7"
        />
      </svg>
    </div>
  );
};

export default LogoIcon;
