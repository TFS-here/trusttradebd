import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tt_admin_token'); // separate key from buyer/seller
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401/403
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if ([401, 403].includes(err.response?.status)) {
      localStorage.removeItem('tt_admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export const adminApi = {
  // Auth
  login: (data)                => api.post('/admin/login', data),

  // Dashboard
  getDashboard: ()             => api.get('/admin/dashboard'),

  // Users
  getUsers: (params)           => api.get('/admin/users', { params }),
  getUser: (id)                => api.get(`/admin/users/${id}`),
  getUserProducts: (id)        => api.get(`/admin/users/${id}/products`),
  blockUser: (id, reason)      => api.patch(`/admin/users/${id}/block`, { reason }),
  unblockUser: (id)            => api.patch(`/admin/users/${id}/unblock`),
  changeRole: (id, role)       => api.patch(`/admin/users/${id}/role`, { role }),

  // Orders
  getOrders: (params)          => api.get('/admin/orders', { params }),
  holdOrder: (id, reason)      => api.patch(`/admin/orders/${id}/hold`, { reason }),
  releaseOrder: (id, note)     => api.patch(`/admin/orders/${id}/release`, { note }),
  refundOrder: (id, note)      => api.patch(`/admin/orders/${id}/refund`, { note }),
  simulateDelivery: (id)       => api.post(`/admin/orders/${id}/simulate-delivery`),
  simulateStatus: (id, status) => api.post(`/admin/orders/${id}/simulate-status`, { status }),

  // Products
  banProduct: (id, reason)     => api.patch(`/admin/products/${id}/ban`, { reason }),
  unbanProduct: (id)           => api.patch(`/admin/products/${id}/unban`),

  // Reviews
  hideReview: (id, reason)     => api.patch(`/admin/reviews/${id}/hide`, { reason }),

  // Disputes
  getDisputes: (params)        => api.get('/disputes', { params }),
  resolveDisputeBuyerFavor: (disputeId, data) =>
    api.post(`/disputes/${disputeId}/resolve-buyer-favor`, data),
  resolveDisputeSellerFavor: (disputeId, data) =>
    api.post(`/disputes/${disputeId}/resolve-seller-favor`, data),

  // Settings
  getSettings: ()              => api.get('/admin/settings'),
  updateSettings: (data)       => api.patch('/admin/settings', data),
};
