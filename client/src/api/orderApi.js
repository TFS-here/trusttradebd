import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Orders ────────────────────────────────────────────────────────
export const orderApi = {
  place: (data)        => api.post('/orders', data),
  createForPayment: (data) => api.post('/orders/create-for-payment', data), // SSLCommerz flow
  getAll: (params)     => api.get('/orders', { params }),
  getSellerAnalytics: ()=> api.get('/orders/seller/analytics'),
  getById: (id)        => api.get(`/orders/${id}`),
  ship: (id, data)     => api.patch(`/orders/${id}/ship`, data),
  confirmDelivery: (id)=> api.patch(`/orders/${id}/confirm-delivery`),
  cancel: (id)         => api.patch(`/orders/${id}/cancel`),
};

// ── Payment (SSLCommerz) ──────────────────────────────────────────
export const paymentApi = {
  /** Initiate SSLCommerz session — returns { GatewayPageURL } */
  initiate: (orderId, idempotencyKey) =>
    api.post(
      '/payment/initiate',
      { orderId },
      idempotencyKey ? { headers: { 'idempotency-key': idempotencyKey } } : {}
    ),
};

// ── Wallet ────────────────────────────────────────────────────────
export const walletApi = {
  getBalance: ()            => api.get('/wallet/balance'),
  deposit: (amount)         => api.post('/wallet/deposit', { amount }),
  getTransactions: (params) => api.get('/wallet/transactions', { params }),
  withdraw: (amount)         => api.post('/wallet/withdraw', { amount }),
};

