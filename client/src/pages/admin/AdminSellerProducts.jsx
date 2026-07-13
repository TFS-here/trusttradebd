import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../../api/adminApi';
import { productApi } from '../../api/productApi';

const AdminSellerProducts = () => {
  const { id } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.getUserProducts(id);
      setProducts(data.data.products);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleToggleBan = async (product) => {
    if (product.isBanned) {
      if (!window.confirm("Are you sure you want to unban this product?")) return;
      try {
        await adminApi.unbanProduct(product._id);
        setProducts(prev => prev.map(p => p._id === product._id ? { ...p, isBanned: false, bannedReason: '' } : p));
      } catch (err) {
        alert("Failed to unban product: " + (err.response?.data?.message || err.message));
      }
    } else {
      const reason = window.prompt("Enter reason for banning this product:");
      if (!reason) return;
      try {
        await adminApi.banProduct(product._id, reason);
        setProducts(prev => prev.map(p => p._id === product._id ? { ...p, isBanned: true, bannedReason: reason } : p));
      } catch (err) {
        alert("Failed to ban product: " + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await productApi.remove(productId);
      setProducts(prev => prev.filter(p => p._id !== productId));
    } catch (err) {
      alert("Failed to delete product: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Link to="/admin/users" className="text-zinc-400 hover:text-white transition">
          ← Back to Users
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Seller Products</h1>
        <p className="text-sm text-zinc-600 mt-0.5">Manage products for seller ID: {id}</p>
      </div>

      <div className="card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-surface-2 rounded-xl" />)}
          </div>
        ) : error ? (
          <p className="text-center py-12 text-rose-400 text-sm">{error}</p>
        ) : products.length === 0 ? (
          <p className="text-center py-12 text-zinc-600 text-sm">This seller has no products.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {products.map(product => (
              <motion.div key={product._id} layout
                className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 transition ${product.isBanned ? 'opacity-60 bg-rose-500/5' : 'hover:bg-white/3'}`}>
                <img src={product.images?.[0] || '/placeholder-product.jpg'}
                  alt="" className="w-16 h-16 rounded-xl object-cover ring-1 ring-white/10 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Link to={`/products/${product._id}`}
                      className="font-semibold text-sm text-zinc-200 hover:text-violet-400 transition truncate">
                      {product.title}
                    </Link>
                    {product.isBanned && <span className="badge-rose text-xs px-2 py-0.5 rounded-full">Banned</span>}
                    {!product.isActive && !product.isBanned && <span className="badge-amber text-xs px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <div className="text-xs text-zinc-500 flex items-center gap-3">
                    <span>৳{product.price.toLocaleString('en-BD')}</span>
                    <span>Stock: {product.stock}</span>
                    <span>Sold: {product.hasSold ? 'Yes' : 'No'}</span>
                  </div>
                  {product.isBanned && product.bannedReason && (
                    <p className="text-xs text-rose-400/80 truncate mt-1">Reason: {product.bannedReason}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-2 shrink-0 flex-col sm:flex-row">
                  <button onClick={() => handleToggleBan(product)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition w-full sm:w-auto ${
                      product.isBanned 
                        ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20' 
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                    }`}>
                    {product.isBanned ? 'Unban' : 'Ban'}
                  </button>
                  <button onClick={() => handleDelete(product._id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition font-medium w-full sm:w-auto">
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSellerProducts;
