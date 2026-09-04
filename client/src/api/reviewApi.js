import apiClient from './apiClient';

export const reviewApi = {
  /** Check if buyer can review a specific order */
  checkEligibility: (orderId) =>
    apiClient.get(`/reviews/eligibility/${orderId}`),

  /** Submit a review */
  create: (data) =>
    apiClient.post('/reviews', data),

  /** Get all reviews for a product (public) */
  getForProduct: (productId, params = {}) =>
    apiClient.get(`/reviews/product/${productId}`, { params }),

  /** Get all reviews received by a seller (public) */
  getForSeller: (sellerId, params = {}) =>
    apiClient.get(`/reviews/seller/${sellerId}`, { params }),

  /** Seller reply to a review */
  reply: (reviewId, comment) =>
    apiClient.post(`/reviews/${reviewId}/reply`, { comment }),

  /** Check if current buyer can review a product (has RELEASED unreviewed order) */
  canReview: (productId) =>
    apiClient.get(`/reviews/can-review/${productId}`),

  /** Buyer's own submitted reviews */
  getMyReviews: () =>
    apiClient.get('/reviews/my-reviews'),
};
