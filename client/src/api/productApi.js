import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Product API calls ─────────────────────────────────────────────

export const productApi = {
  /**
   * GET /products — paginated list with optional filters
   * @param {Object} params  { page, limit, category, search, sort, inStock, minPrice, maxPrice }
   */
  getAll: (params = {}) =>
    api.get('/products', { params }),

  /**
   * GET /products/:id — single product + related
   */
  getById: (id) =>
    api.get(`/products/${id}`),

  /**
   * GET /products/seller/my-products — seller's own listings
   */
  getMyProducts: (params = {}) =>
    api.get('/products/seller/my-products', { params }),

  /**
   * POST /products — create a new listing (seller only)
   */
  create: (data) =>
    api.post('/products', data),

  /**
   * PUT /products/:id — update title, price, stock, etc.
   */
  update: (id, data) =>
    api.put(`/products/${id}`, data),

  /**
   * PATCH /products/:id/restock — add quantity to existing stock
   */
  restock: (id, quantity) =>
    api.patch(`/products/${id}/restock`, { quantity }),

  /**
   * DELETE /products/:id — soft or hard delete
   */
  remove: (id) =>
    api.delete(`/products/${id}`),
};
