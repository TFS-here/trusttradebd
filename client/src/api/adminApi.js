import apiClient from './apiClient';

export const adminApi = {
  // Auth
  login: (data)                => apiClient.post('/admin/login', data),

  // Dashboard
  getDashboard: ()             => apiClient.get('/admin/dashboard'),

  // Users
  getUsers: (params)           => apiClient.get('/admin/users', { params }),
  getUser: (id)                => apiClient.get(`/admin/users/${id}`),
  getUserProducts: (id)        => apiClient.get(`/admin/users/${id}/products`),
  blockUser: (id, reason)      => apiClient.patch(`/admin/users/${id}/block`, { reason }),
  unblockUser: (id)            => apiClient.patch(`/admin/users/${id}/unblock`),
  changeRole: (id, role)       => apiClient.patch(`/admin/users/${id}/role`, { role }),

  // Orders
  getOrders: (params)          => apiClient.get('/admin/orders', { params }),
  holdOrder: (id, reason)      => apiClient.patch(`/admin/orders/${id}/hold`, { reason }),
  releaseOrder: (id, note)     => apiClient.patch(`/admin/orders/${id}/release`, { note }),
  refundOrder: (id, note)      => apiClient.patch(`/admin/orders/${id}/refund`, { note }),
  simulateDelivery: (id)       => apiClient.post(`/admin/orders/${id}/simulate-delivery`),
  simulateStatus: (id, status) => apiClient.post(`/admin/orders/${id}/simulate-status`, { status }),

  // Products
  banProduct: (id, reason)     => apiClient.patch(`/admin/products/${id}/ban`, { reason }),
  unbanProduct: (id)           => apiClient.patch(`/admin/products/${id}/unban`),

  // Reviews
  hideReview: (id, reason)     => apiClient.patch(`/admin/reviews/${id}/hide`, { reason }),

  // Disputes
  getDisputes: (params)        => apiClient.get('/disputes', { params }),
  resolveDisputeBuyerFavor: (disputeId, data) =>
    apiClient.post(`/disputes/${disputeId}/resolve-buyer-favor`, data),
  resolveDisputeSellerFavor: (disputeId, data) =>
    apiClient.post(`/disputes/${disputeId}/resolve-seller-favor`, data),

  // Settings
  getSettings: ()              => apiClient.get('/admin/settings'),
  updateSettings: (data)       => apiClient.patch('/admin/settings', data),
};
