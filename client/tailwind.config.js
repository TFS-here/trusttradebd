/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── Surface scale ──────────────────────────────────────
        surface: {
          0: '#09090B',   // page base (zinc-950)
          1: '#111113',   // card base
          2: '#18181B',   // elevated / hover
          3: '#27272A',   // input / muted areas
        },
        // ── Brand ─────────────────────────────────────────────
        violet: {
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
        },
        // ── Semantic ───────────────────────────────────────────
        emerald: {
          400: '#34D399',
          500: '#10B981',
        },
        amber: {
          400: '#FBBF24',
          500: '#F59E0B',
        },
        rose: {
          400: '#FB7185',
          500: '#F43F5E',
        },
        // ── Text ──────────────────────────────────────────────
        zinc: {
          100: '#F4F4F5',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B',
          950: '#09090B',
        },
      },
      boxShadow: {
        'glow-violet': '0 0 20px rgba(139, 92, 246, 0.35), 0 0 60px rgba(139, 92, 246, 0.1)',
        'glow-emerald': '0 0 20px rgba(52, 211, 153, 0.3)',
        'glow-amber':   '0 0 20px rgba(251, 191, 36, 0.3)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-hover': '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.2)',
      },
      backgroundImage: {
        'gradient-violet': 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
        'gradient-emerald': 'linear-gradient(135deg, #34D399, #059669)',
        'gradient-surface': 'linear-gradient(180deg, #111113 0%, #09090B 100%)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      animation: {
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' },
          '50%':       { boxShadow: '0 0 40px rgba(139, 92, 246, 0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
