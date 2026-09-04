import apiClient from './apiClient';

export const qaApi = {
  getForProduct: (productId, params = {}) =>
    apiClient.get(`/qa/product/${productId}`, { params }),

  ask: (productId, question) =>
    apiClient.post(`/qa/product/${productId}`, { question }),

  answer: (questionId, answer) =>
    apiClient.put(`/qa/${questionId}/answer`, { answer }),

  delete: (questionId) =>
    apiClient.delete(`/qa/${questionId}`),

  getPendingForSeller: () =>
    apiClient.get('/qa/seller/pending'),
};
