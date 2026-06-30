import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const qaApi = {
  getForProduct: (productId, params = {}) =>
    api.get(`/qa/product/${productId}`, { params }),

  ask: (productId, question) =>
    api.post(`/qa/product/${productId}`, { question }),

  answer: (questionId, answer) =>
    api.put(`/qa/${questionId}/answer`, { answer }),

  delete: (questionId) =>
    api.delete(`/qa/${questionId}`),

  getPendingForSeller: () =>
    api.get('/qa/seller/pending'),
};
