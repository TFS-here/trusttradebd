import apiClient from './apiClient';

export const chatApi = {
  /** GET /api/chat/:orderId — Fetch all messages for an order thread */
  getMessages: (orderId) => apiClient.get(`/chat/${orderId}`),

  /** POST /api/chat — Send a new message */
  sendMessage: (data) => apiClient.post('/chat', data),
};
