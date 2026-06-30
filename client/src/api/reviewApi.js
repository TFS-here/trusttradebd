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

export const reviewApi = {
  /** Check if buyer can review a specific order */
  checkEligibility: (orderId) =>
    api.get(`/reviews/eligibility/${orderId}`),

  /** Submit a review */
  create: (data) =>
    api.post('/reviews', data),

  /** Get all reviews for a product (public) */
  getForProduct: (productId, params = {}) =>
    api.get(`/reviews/product/${productId}`, { params }),

  /** Get all reviews received by a seller (public) */
  getForSeller: (sellerId, params = {}) =>
    api.get(`/reviews/seller/${sellerId}`, { params }),

  /** Seller reply to a review */
  reply: (reviewId, comment) =>
    api.post(`/reviews/${reviewId}/reply`, { comment }),

  /** Check if current buyer can review a product (has RELEASED unreviewed order) */
  canReview: (productId) =>
    api.get(`/reviews/can-review/${productId}`),

  /** Buyer's own submitted reviews */
  getMyReviews: () =>
    api.get('/reviews/my-reviews'),
};
