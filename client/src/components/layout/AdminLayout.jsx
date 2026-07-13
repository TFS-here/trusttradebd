import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import LogoIcon from '../brand/LogoIcon';

const NAV = [
  { label: 'Dashboard', to: '/admin/dashboard',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /> },
  { label: 'Users', to: '/admin/users',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /> },
  { label: 'Orders', to: '/admin/orders',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /> },
  { label: 'Disputes', to: '/admin/disputes',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> },
  { label: 'Simulator', to: '/admin/simulator',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.798-1.414 2.798H4.213c-1.444 0-2.414-1.798-1.414-2.798L4.2 15.3" /> },
  { label: 'Settings', to: '/admin/settings',
    icon: <g><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></g> },
];

// Reusable nav items (used in both sidebar and drawer)
const NavItems = ({ onNavClick, navigate, idPrefix }) => (
  <>
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV.map(item => (
        <NavLink key={item.to} to={item.to}
          onClick={onNavClick}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
             transition-all duration-200 group relative overflow-hidden
             ${isActive
               ? 'text-white bg-violet-500/20 border border-violet-500/30'
               : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'}`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.div layoutId={`${idPrefix}-admin-indicator`}
                  className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-400 rounded-r"
                  style={{ boxShadow: '0 0 8px rgba(139,92,246,0.8)' }} />
              )}
              <svg className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-violet-400' : 'text-zinc-600 group-hover:text-zinc-400'}`}
                   fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                {item.icon}
              </svg>
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>

    {/* Sign out */}
    <div className="px-3 py-4 border-t border-white/5">
      <button onClick={() => { localStorage.removeItem('tt_admin_token'); navigate('/admin/login', { replace: true }); }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                   text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
        </svg>
        Sign out
      </button>
    </div>
  </>
);

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = () => setDrawerOpen(false);

  // Automatically close the drawer whenever the route changes
  useEffect(() => {
    closeDrawer();
  }, [location.pathname]);

  // Current page label for mobile header
  const currentPage = NAV.find(n => location.pathname.startsWith(n.to))?.label || 'Admin';

  return (
    <div className="min-h-screen flex bg-surface-0">

      {/* ── Desktop Sidebar (hidden on mobile) ────────────────────── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-white/5"
             style={{ background: 'linear-gradient(180deg, #0D0D10 0%, #09090B 100%)' }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5 group">
            <LogoIcon size="sm" />
            <div className="flex flex-col leading-none">
              <p className="text-white font-extrabold text-sm leading-none">TrustTrade</p>
              <p className="text-amber-400/70 text-[9px] mt-1 font-bold tracking-[0.2em] uppercase">Admin Panel</p>
            </div>
          </div>
        </div>

        <NavItems onNavClick={() => {}} navigate={navigate} idPrefix="desktop" />
      </aside>

      {/* ── Mobile Top Header (visible only on mobile) ─────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b border-white/5"
           style={{ background: 'linear-gradient(135deg, #0D0D10 0%, #09090B 100%)' }}>
        {/* Hamburger */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/8 transition-all"
          aria-label="Open navigation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Logo + Page Label */}
        <div className="flex items-center gap-2">
          <LogoIcon size="sm" />
          <div className="flex flex-col leading-none">
            <p className="text-white font-extrabold text-xs leading-none">TrustTrade</p>
            <p className="text-amber-400/70 text-[8px] mt-0.5 font-bold tracking-[0.15em] uppercase">Admin · {currentPage}</p>
          </div>
        </div>

        {/* Right spacer */}
        <div className="w-9" />
      </div>

      {/* ── Mobile Drawer ─────────────────────────────────────────── */}
      {/*
        Structure: backdrop (full-screen) wraps the drawer panel.
        - Clicking the backdrop (outside the drawer) fires closeDrawer.
        - The drawer panel stops propagation so taps inside don't
          bubble up to the backdrop and accidentally close it.
        - The close button directly calls closeDrawer.
      */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={closeDrawer}
          >
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute top-0 left-0 bottom-0 w-72 flex flex-col border-r border-white/5 shadow-2xl"
              style={{ background: 'linear-gradient(180deg, #0D0D10 0%, #09090B 100%)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <LogoIcon size="sm" />
                  <div className="flex flex-col leading-none">
                    <p className="text-white font-extrabold text-sm leading-none">TrustTrade</p>
                    <p className="text-amber-400/70 text-[9px] mt-1 font-bold tracking-[0.2em] uppercase">Admin Panel</p>
                  </div>
                </div>

                {/* Close button — 48×48 minimum touch target */}
                <button
                  type="button"
                  onClick={closeDrawer}
                  style={{ touchAction: 'manipulation' }}
                  className="flex items-center justify-center w-10 h-10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/8 active:bg-white/15 transition-colors"
                  aria-label="Close navigation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <NavItems onNavClick={closeDrawer} navigate={navigate} idPrefix="mobile" />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <main className="flex-1 min-h-screen overflow-auto pt-14 md:pt-0">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {children || <Outlet />}
        </motion.div>
      </main>
    </div>
  );
};

export default AdminLayout;
