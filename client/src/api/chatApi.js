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

export const chatApi = {
  /** GET /api/chat/:orderId — Fetch all messages for an order thread */
  getMessages: (orderId) => api.get(`/chat/${orderId}`),

  /** POST /api/chat — Send a new message */
  sendMessage: (data) => api.post('/chat', data),
};
