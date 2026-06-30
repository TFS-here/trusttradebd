import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Spinner = () => (
  <div className="min-h-screen bg-surface-0 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
        <div className="absolute inset-2 rounded-full bg-violet-500/10" />
      </div>
      <p className="text-sm text-zinc-600 font-medium">Loading…</p>
    </div>
  </div>
);

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
};

export const RoleRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!roles.includes(user.role)) {
    const roleHome = { buyer: '/', seller: '/seller/dashboard', admin: '/admin/dashboard' };
    return <Navigate to={roleHome[user.role] || '/'} replace />;
  }
  return children;
};

export const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('tt_admin_token');
  const location = useLocation();
  if (!token) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  return children;
};

export const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) {
    const roleHome = { buyer: '/', seller: '/seller/dashboard', admin: '/admin/dashboard' };
    return <Navigate to={roleHome[user.role] || '/'} replace />;
  }
  return children;
};
