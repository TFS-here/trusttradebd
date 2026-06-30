import { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import {
  ProtectedRoute,
  RoleRoute,
  AdminRoute,
  GuestRoute,
} from './components/routes/RouteGuards';
import Navbar from './components/layout/Navbar';
import AdminLayout from './components/layout/AdminLayout';
import { orderApi } from './api/orderApi';

// ── Lazy-loaded pages ─────────────────────────────────────────────
// Auth
const LoginPage    = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));

// Buyer
const HomePage       = lazy(() => import('./pages/buyer/HomePage'));
const ProductDetail  = lazy(() => import('./pages/buyer/ProductDetail'));
const OrderDetail    = lazy(() => import('./pages/buyer/OrderDetail'));
const WalletPanel    = lazy(() => import('./pages/buyer/WalletPanel'));
const PlaceOrderPage = lazy(() => import('./pages/buyer/PlaceOrderPage'));
const ProfilePage    = lazy(() => import('./pages/buyer/ProfilePage'));
const PaymentStatusPage = lazy(() => import('./pages/buyer/PaymentStatusPage'));

// Seller
const SellerProducts    = lazy(() => import('./pages/seller/SellerProducts'));
const SellerOrders      = lazy(() => import('./pages/seller/SellerOrders'));
const SellerReviewsPage  = lazy(() => import('./pages/seller/SellerReviewsPage'));
const CreateProductPage  = lazy(() => import('./pages/seller/CreateProductPage'));

// Admin
const AdminLogin     = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers     = lazy(() => import('./pages/admin/AdminUsers'));
const AdminOrders    = lazy(() => import('./pages/admin/AdminOrders'));

// ── Page transition ───────────────────────────────────────────────
const PageTransition = ({ children }) => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// ── Loading fallback ──────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── Main layout ───────────────────────────────────────────────────
const MainLayout = ({ children }) => (
  <>
    <Navbar />
    <main className="min-h-[calc(100vh-3.5rem)]">
      <PageTransition>{children}</PageTransition>
    </main>
  </>
);

// ── Buyer order list ──────────────────────────────────────────────
const STATUS_STYLES = {
  LOCKED:    'bg-amber-100 text-amber-700',
  SHIPPED:   'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-indigo-100 text-indigo-700',
  RELEASED:  'bg-green-100 text-green-700',
  ON_HOLD:   'bg-red-100 text-red-700',
  REFUNDED:  'bg-gray-100 text-gray-500',
};

const BuyerOrderList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderApi.getAll({ limit: 20 })
      .then(({ data }) => setOrders(data.data.orders))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>
      {loading && [...Array(3)].map((_, i) => (
        <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
      ))}
      {!loading && orders.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🛍️</div>
          <p className="text-gray-500">You haven't placed any orders yet.</p>
          <Link to="/" className="mt-3 inline-block text-blue-600 hover:underline text-sm">
            Browse products →
          </Link>
        </div>
      )}
      {orders.map((order) => (
        <Link
          key={order._id}
          to={`/orders/${order._id}`}
          className="card flex items-center gap-4 px-5 py-4 hover:shadow-md
                     hover:border-gray-200 transition-all block"
        >
          <img
            src={order.items[0]?.image || '/placeholder-product.jpg'}
            alt=""
            className="w-14 h-14 rounded-xl object-cover bg-gray-50 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono text-sm font-bold text-gray-800">
                #{order._id.slice(-8).toUpperCase()}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold
                                ${STATUS_STYLES[order.escrowStatus] || ''}`}>
                {order.escrowStatus}
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''} ·{' '}
              {new Date(order.createdAt).toLocaleDateString('en-BD', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
          <p className="font-bold text-gray-800 shrink-0">
            ৳{order.totalAmount.toLocaleString('en-BD')}
          </p>
        </Link>
      ))}
    </div>
  );
};

// ── App ───────────────────────────────────────────────────────────
const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <CartProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Guest only ────────────────────────────────────── */}
          <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

          {/* ── Public browsing ───────────────────────────────── */}
          <Route path="/"             element={<MainLayout><HomePage /></MainLayout>} />
          <Route path="/products/:id" element={<MainLayout><ProductDetail /></MainLayout>} />

          {/* ── Shared authenticated ──────────────────────────── */}
          <Route path="/profile" element={
            <ProtectedRoute><MainLayout><ProfilePage /></MainLayout></ProtectedRoute>
          } />
          <Route path="/wallet" element={
            <ProtectedRoute><MainLayout><WalletPanel /></MainLayout></ProtectedRoute>
          } />
          <Route path="/payment/success" element={
            <ProtectedRoute><MainLayout><PaymentStatusPage /></MainLayout></ProtectedRoute>
          } />
          <Route path="/payment/failed" element={
            <ProtectedRoute><MainLayout><PaymentStatusPage /></MainLayout></ProtectedRoute>
          } />

          {/* ── Buyer ─────────────────────────────────────────── */}
          <Route path="/orders" element={
            <ProtectedRoute><MainLayout><BuyerOrderList /></MainLayout></ProtectedRoute>
          } />
          <Route path="/orders/:id" element={
            <ProtectedRoute><MainLayout><OrderDetail role="buyer" /></MainLayout></ProtectedRoute>
          } />
          <Route path="/checkout" element={
            <RoleRoute roles={['buyer']}>
              <MainLayout><PlaceOrderPage /></MainLayout>
            </RoleRoute>
          } />

          {/* ── Seller ────────────────────────────────────────── */}
          <Route path="/seller/dashboard" element={<Navigate to="/seller/products" replace />} />
          <Route path="/seller/products"  element={
            <RoleRoute roles={['seller']}><MainLayout><SellerProducts /></MainLayout></RoleRoute>
          } />
          <Route path="/seller/products/new" element={
            <RoleRoute roles={['seller']}><MainLayout><CreateProductPage /></MainLayout></RoleRoute>
          } />
          <Route path="/seller/orders" element={
            <RoleRoute roles={['seller']}><MainLayout><SellerOrders /></MainLayout></RoleRoute>
          } />
          <Route path="/seller/orders/:id" element={
            <RoleRoute roles={['seller']}><MainLayout><OrderDetail role="seller" /></MainLayout></RoleRoute>
          } />
          <Route path="/seller/reviews" element={
            <RoleRoute roles={['seller']}><MainLayout><SellerReviewsPage /></MainLayout></RoleRoute>
          } />

          {/* ── Admin ─────────────────────────────────────────── */}
          <Route path="/admin"           element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/login"     element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={
            <AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>
          } />
          <Route path="/admin/users"  element={
            <AdminRoute><AdminLayout><AdminUsers /></AdminLayout></AdminRoute>
          } />
          <Route path="/admin/orders" element={
            <AdminRoute><AdminLayout><AdminOrders /></AdminLayout></AdminRoute>
          } />

          {/* ── 404 ───────────────────────────────────────────── */}
          <Route path="*" element={
            <MainLayout>
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <p className="text-7xl font-black text-gray-100 mb-4">404</p>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Page not found</h1>
                <p className="text-gray-500 mb-6">This page doesn't exist or has been moved.</p>
                <Link to="/" className="btn-primary">← Back to home</Link>
              </div>
            </MainLayout>
          } />

        </Routes>
      </Suspense>
      </CartProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
