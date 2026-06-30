import { useState, useEffect, useCallback } from 'react';
import { productApi } from '../api/productApi';

/**
 * useProducts — fetch + filter a paginated list of products.
 *
 * @param {Object} initialParams  Initial query params
 * @returns { products, pagination, loading, error, setParams, refetch }
 */
export const useProducts = (initialParams = {}) => {
  const [params, setParams] = useState({ page: 1, limit: 20, ...initialParams });
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await productApi.getAll(params);
      setProducts(data.data.products);
      setPagination(data.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetch(); }, [fetch]);

  return { products, pagination, loading, error, setParams, refetch: fetch };
};

/**
 * useProduct — fetch a single product with related products.
 *
 * @param {string} id  Product ObjectId
 */
export const useProduct = (id) => {
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await productApi.getById(id);
      setProduct(data.data.product);
      setRelated(data.data.related);
    } catch (err) {
      setError(err.response?.data?.message || 'Product not found.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { product, related, loading, error, refetch: fetch };
};

/**
 * useMyProducts — seller's own product list with status filters.
 */
export const useMyProducts = (initialParams = {}) => {
  const [params, setParams] = useState(initialParams);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await productApi.getMyProducts(params);
      setProducts(data.data.products);
      setPagination(data.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your products.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetch(); }, [fetch]);

  // Restock a product and refresh the list
  const restock = async (productId, quantity) => {
    const { data } = await productApi.restock(productId, quantity);
    // Optimistically update the item in state
    setProducts((prev) =>
      prev.map((p) => (p._id === productId ? data.data.product : p))
    );
    return data;
  };

  // Toggle active/inactive
  const toggleActive = async (productId, currentState) => {
    const { data } = await productApi.update(productId, { isActive: !currentState });
    setProducts((prev) =>
      prev.map((p) => (p._id === productId ? data.data.product : p))
    );
    return data;
  };

  return { products, pagination, loading, error, setParams, refetch: fetch, restock, toggleActive };
};
