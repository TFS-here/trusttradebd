import apiClient from './apiClient';

// ── Orders ────────────────────────────────────────────────────────
export const orderApi = {
  place: (data)        => apiClient.post('/orders', data),
  createForPayment: (data) => apiClient.post('/orders/create-for-payment', data), // SSLCommerz flow
  getAll: (params)     => apiClient.get('/orders', { params }),
  getSellerAnalytics: ()=> apiClient.get('/orders/seller/analytics'),
  getById: (id)        => apiClient.get(`/orders/${id}`),
  ship: (id, data)     => apiClient.patch(`/orders/${id}/ship`, data),
  confirmDelivery: (id)=> apiClient.patch(`/orders/${id}/confirm-delivery`),
  cancel: (id)         => apiClient.patch(`/orders/${id}/cancel`),
};

// ── Payment (SSLCommerz) ──────────────────────────────────────────
export const paymentApi = {
  /** Initiate SSLCommerz session — returns { GatewayPageURL } */
  initiate: (orderId, idempotencyKey) =>
    apiClient.post(
      '/payment/initiate',
      { orderId },
      idempotencyKey ? { headers: { 'idempotency-key': idempotencyKey } } : {}
    ),
};

// ── Wallet ────────────────────────────────────────────────────────
export const walletApi = {
  getBalance: ()            => apiClient.get('/wallet/balance'),
  deposit: (amount)         => apiClient.post('/wallet/deposit', { amount }),
  getTransactions: (params) => apiClient.get('/wallet/transactions', { params }),
  withdraw: (amount)         => apiClient.post('/wallet/withdraw', { amount }),
};
