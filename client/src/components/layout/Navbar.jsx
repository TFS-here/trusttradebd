import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import CartDrawer from '../cart/CartDrawer';
import LogoIcon from '../brand/LogoIcon';

// ── Logo ──────────────────────────────────────────────────────────
const Logo = () => (
  <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
    <LogoIcon size="md" />
    <div className="flex flex-col leading-none">
      <span className="font-extrabold text-lg tracking-tight text-white">
        TrustTrade
      </span>
      <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-amber-400/80">
        Bangladesh
      </span>
    </div>
  </Link>
);

// ── Magnetic Button wrapper ───────────────────────────────────────
const MagneticButton = ({ children, className = '', onClick, disabled }) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  const handleMouse = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    x.set((e.clientX - cx) * 0.25);
    y.set((e.clientY - cy) * 0.25);
  };

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouse}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </motion.button>
  );
};

// ── Nav link ──────────────────────────────────────────────────────
const NavItem = ({ to, children, end }) => (
  <NavLink to={to} end={end}
    className={({ isActive }) =>
      `relative text-sm font-medium transition-colors duration-200 py-1 group
       ${isActive ? 'text-violet-400' : 'text-zinc-400 hover:text-zinc-100'}`
    }
  >
    {({ isActive }) => (
      <>
        {children}
        {isActive && (
          <motion.div
            layoutId="nav-indicator"
            className="absolute -bottom-0.5 left-0 right-0 h-px bg-violet-400"
            style={{ boxShadow: '0 0 8px rgba(139,92,246,0.8)' }}
          />
        )}
      </>
    )}
  </NavLink>
);

// ── User dropdown ────────────────────────────────────────────────
const UserMenu = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const roleLabelMap = { buyer: 'Buyer', seller: 'Seller', admin: 'Admin' };

  const menuItems = {
    buyer:  [{ label: 'My Orders', to: '/orders' }, { label: 'Wallet', to: '/wallet' }, { label: 'Profile', to: '/profile' }],
    seller: [{ label: 'Dashboard', to: '/seller/dashboard' }, { label: 'Products', to: '/seller/products' }, { label: 'Orders', to: '/seller/orders' }, { label: 'Reviews & Q&A', to: '/seller/reviews' }, { label: 'Wallet', to: '/wallet' }, { label: 'Profile', to: '/profile' }],
    admin:  [{ label: 'Dashboard', to: '/admin/dashboard' }],
  };

  const items = menuItems[user.role] || [];
  const available = user.wallet?.availableBalance ?? user.wallet?.balance ?? 0;

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/5
                   border border-transparent hover:border-white/10 transition-all duration-200">
        <div className="relative">
          <img
            src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7C3AED&color=fff&size=64`}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-violet-500/30"
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-surface-0" />
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold text-zinc-100 leading-none">{user.name}</p>
          <p className="text-xs text-violet-400 mt-0.5">{roleLabelMap[user.role]}</p>
        </div>
        <svg className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
             fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <motion.div
        initial={false}
        animate={open ? "open" : "closed"}
        variants={{ open: { opacity: 1, display: 'block' }, closed: { opacity: 0, display: 'none' } }}
        className="fixed inset-0 z-30" 
        onClick={() => setOpen(false)} 
      />
      
      <motion.div
        initial={false}
        animate={open ? "open" : "closed"}
        variants={{
          open: { opacity: 1, y: 0, scale: 1, pointerEvents: 'auto' },
          closed: { opacity: 0, y: 8, scale: 0.95, pointerEvents: 'none' }
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="absolute right-0 top-full mt-2 w-56 z-40 card-glass rounded-2xl
                   shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden"
      >
        {/* User info */}
        <div className="px-4 py-3 border-b border-white/8">
          <p className="text-sm font-semibold text-zinc-100 truncate">{user.name}</p>
          <p className="text-xs text-zinc-500 truncate mt-0.5">{user.email}</p>
          {user.wallet && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400 font-semibold">
                ৳{available.toLocaleString('en-BD')} available
              </span>
            </div>
          )}
        </div>

        {/* Menu items */}
        <div className="py-1">
          {items.map(item => (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300
                         hover:text-white hover:bg-violet-500/10 transition-colors">
              {item.label}
            </Link>
          ))}
        </div>

        {/* Sign out */}
        <div className="border-t border-white/8 py-1">
          <button onClick={() => { setOpen(false); onLogout(); }}
            className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm
                       text-rose-400 hover:bg-rose-500/10 transition-colors">
            <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main Navbar ───────────────────────────────────────────────────
const Navbar = () => {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const navLinks =
    user?.role === 'seller'
      ? [{ label: 'Dashboard', to: '/seller/dashboard' }, { label: 'Browse', to: '/', end: true }, { label: 'Products', to: '/seller/products' }, { label: 'Orders', to: '/seller/orders' }]
      : user?.role === 'admin'
      ? [{ label: 'Dashboard', to: '/admin/dashboard' }]
      : [{ label: 'Browse', to: '/', end: true }, { label: 'My Orders', to: '/orders' }];

  return (
    <>
      <header className="sticky top-0 z-20">
        {/* Glass background */}
        <div className="absolute inset-0 bg-surface-0/80 backdrop-blur-xl border-b border-white/5" />

        <nav className="relative max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Logo />

          {/* Desktop nav */}
          {user && (
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map(l => (
                <NavItem key={l.to} to={l.to} end={l.end}>{l.label}</NavItem>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* Wallet quick balance */}
                {user.role !== 'admin' && (
                  <Link to="/wallet"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                               text-xs font-semibold text-emerald-400 bg-emerald-400/10
                               border border-emerald-400/20 hover:bg-emerald-400/15 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                    </svg>
                    ৳{(user.wallet?.availableBalance ?? 0).toLocaleString('en-BD')}
                  </Link>
                )}

                {/* Cart */}
                {user.role === 'buyer' && (
                  <MagneticButton onClick={() => setCartOpen(true)}
                    className="relative p-2 rounded-xl text-zinc-400 hover:text-violet-400
                               hover:bg-violet-500/10 transition-all border border-transparent
                               hover:border-violet-500/20">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                    </svg>
                    <AnimatePresence>
                      {totalItems > 0 && (
                        <motion.span
                          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 text-white
                                     text-[10px] font-bold rounded-full flex items-center justify-center
                                     shadow-glow-violet">
                          {totalItems > 9 ? '9+' : totalItems}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </MagneticButton>
                )}

                <UserMenu user={user} onLogout={handleLogout} />

                {/* Mobile hamburger */}
                <button onClick={() => setMobileOpen(v => !v)}
                  className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    {mobileOpen
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
                  </svg>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {localStorage.getItem('tt_admin_token') && (
                  <Link to="/admin/dashboard" className="hidden sm:block btn-secondary text-sm px-4 py-2 bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/20">
                    Return to Admin
                  </Link>
                )}
                <Link to="/login" className="btn-ghost text-sm px-4 py-2">Sign in</Link>
                <Link to="/register" className="btn-primary text-sm px-4 py-2">Get started</Link>
              </div>
            )}
          </div>
        </nav>

        <motion.div
          initial={false}
          animate={mobileOpen ? "open" : "closed"}
          variants={{
            open: { height: 'auto', opacity: 1, pointerEvents: 'auto' },
            closed: { height: 0, opacity: 0, pointerEvents: 'none' }
          }}
          className="md:hidden border-t border-white/5 overflow-hidden relative bg-surface-0/95 backdrop-blur-xl"
        >
          <div 
            className="px-4 py-3 space-y-1"
            onClick={() => setMobileOpen(false)}
          >
            {user ? (
              navLinks.map(l => (
                <NavLink key={l.to} to={l.to} end={l.end}
                  className={({ isActive }) =>
                    `block px-3 py-2.5 rounded-xl text-sm font-medium transition
                     ${isActive ? 'bg-violet-500/15 text-violet-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`
                  }
                >
                  {l.label}
                </NavLink>
              ))
            ) : (
              localStorage.getItem('tt_admin_token') && (
                <Link to="/admin/dashboard" onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-xl text-sm font-medium transition text-violet-400 hover:bg-violet-500/15">
                  Return to Admin
                </Link>
              )
            )}
          </div>
        </motion.div>
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
};

export default Navbar;
