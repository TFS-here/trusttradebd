import apiClient from './apiClient';

// ── Product API calls ─────────────────────────────────────────────

export const productApi = {
  /**
   * GET /products — paginated list with optional filters
   * @param {Object} params  { page, limit, category, search, sort, inStock, minPrice, maxPrice }
   */
  getAll: (params = {}) =>
    apiClient.get('/products', { params }),

  /**
   * GET /products/:id — single product + related
   */
  getById: (id) =>
    apiClient.get(`/products/${id}`),

  /**
   * GET /products/seller/my-products — seller's own listings
   */
  getMyProducts: (params = {}) =>
    apiClient.get('/products/seller/my-products', { params }),

  /**
   * POST /products — create a new listing (seller only)
   */
  create: (data) =>
    apiClient.post('/products', data),

  /**
   * PUT /products/:id — update title, price, stock, etc.
   */
  update: (id, data) =>
    apiClient.put(`/products/${id}`, data),

  /**
   * PATCH /products/:id/restock — add quantity to existing stock
   */
  restock: (id, quantity) =>
    apiClient.patch(`/products/${id}/restock`, { quantity }),

  /**
   * DELETE /products/:id — soft or hard delete
   */
  remove: (id) =>
    apiClient.delete(`/products/${id}`),

  /**
   * POST /upload — upload an image to Cloudinary
   */
  uploadImage: (formData) =>
    apiClient.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
