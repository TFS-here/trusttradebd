import { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useProduct } from '../../hooks/useProduct';
import { productApi } from '../../api/productApi';
import { adminApi } from '../../api/adminApi';
import StockBadge from '../../components/product/StockBadge';
import ProductCard from '../../components/product/ProductCard';
import ReviewSection from '../../components/review/ReviewSection';
import QASection from '../../components/review/QASection';
import WriteReview from '../../components/review/WriteReview';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { product, related, loading, error } = useProduct(id);
  const { addItem } = useCart();
  const { user } = useAuth();
  
  const [deleting, setDeleting] = useState(false);
  const [banning, setBanning] = useState(false);

  const handleDeleteProduct = async () => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    setDeleting(true);
    try {
      await productApi.remove(id);
      navigate('/');
    } catch (err) {
      alert("Failed to delete product: " + (err.response?.data?.message || err.message));
      setDeleting(false);
    }
  };

  const handleToggleBan = async () => {
    if (product.isBanned) {
      if (!window.confirm("Are you sure you want to unban this product?")) return;
      setBanning(true);
      try {
        await adminApi.unbanProduct(id);
        window.location.reload();
      } catch (err) {
        alert("Failed to unban product: " + (err.response?.data?.message || err.message));
        setBanning(false);
      }
    } else {
      const reason = window.prompt("Enter reason for banning this product:");
      if (!reason) return;
      setBanning(true);
      try {
        await adminApi.banProduct(id, reason);
        window.location.reload();
      } catch (err) {
        alert("Failed to ban product: " + (err.response?.data?.message || err.message));
        setBanning(false);
      }
    }
  };

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity]           = useState(1);
  const [cartFeedback, setCartFeedback]   = useState(false);
  const [replacedSeller, setReplacedSeller] = useState(false);

  const isOutOfStock = !product || product.stock === 0 || !product.isActive;
  const isLowStock   = product && product.stock > 0 && product.stock <= 5;
  const maxQty       = product ? Math.min(product.stock, 10) : 1;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    const { replaced } = addItem(product, quantity);
    if (replaced) setReplacedSeller(true);
    setCartFeedback(true);
    setTimeout(() => setCartFeedback(false), 2500);
    setTimeout(() => setReplacedSeller(false), 4000);
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
        <div className="aspect-square bg-surface-2 rounded-2xl" />
        <div className="space-y-4">
          <div className="h-6 bg-surface-2 rounded-xl w-3/4" />
          <div className="h-4 bg-surface-2 rounded-xl w-1/2" />
          <div className="h-10 bg-surface-2 rounded-xl w-1/3" />
        </div>
      </div>
    </div>
  );

  if (error || !product) return (
    <div className="max-w-6xl mx-auto px-4 py-12 text-center">
      <p className="text-zinc-600 text-lg">{error || 'Product not found.'}</p>
      <Link to="/" className="mt-4 inline-block text-violet-400 hover:text-violet-300">← Back to products</Link>
    </div>
  );

  const { title, description, price, images, rating, reviewCount, stock, seller, category, tags } = product;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-600 mb-6">
        <Link to="/" className="hover:text-zinc-400 transition">Home</Link>
        <span>/</span>
        <Link to="/" className="hover:text-zinc-400 transition">Products</Link>
        <span>/</span>
        <span className="capitalize text-zinc-500">{category}</span>
        <span>/</span>
        <span className="text-zinc-400 line-clamp-1">{title}</span>
      </nav>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-16">

        {/* Images */}
        <div className="space-y-3">
          <motion.div key={selectedImage} initial={{ opacity: 0.7 }} animate={{ opacity: 1 }}
            className="aspect-square rounded-2xl overflow-hidden bg-surface-2 border border-white/5 relative group">
            <img src={images?.[selectedImage] || '/placeholder-product.jpg'} alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={e => { e.target.src = '/placeholder-product.jpg'; }} />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-surface-0/40 via-transparent to-transparent" />
          </motion.div>
          {images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button key={i} onClick={() => setSelectedImage(i)}
                  className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all
                              ${i === selectedImage ? 'border-violet-500/60 shadow-glow-violet/20' : 'border-white/8 hover:border-white/20'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold text-zinc-100 leading-snug">{title}</h1>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <StockBadge stock={stock} showCount size="sm" />
                {user?.role === 'admin' && (
                  <div className="flex gap-2">
                    <button onClick={handleToggleBan} disabled={banning}
                      className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition">
                      {banning ? 'Processing...' : (product.isBanned ? 'Unban Product' : 'Ban Product')}
                    </button>
                    <button onClick={handleDeleteProduct} disabled={deleting}
                      className="text-xs px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition">
                      {deleting ? 'Deleting...' : 'Delete Product'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            {reviewCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} className={`w-4 h-4 ${s <= Math.round(rating) ? 'text-amber-400' : 'text-zinc-700'}`}
                         fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-zinc-500">{rating.toFixed(1)} ({reviewCount} reviews)</span>
              </div>
            )}
          </div>

          {/* Price */}
          <div className="text-3xl font-extrabold text-zinc-100">
            ৳{price.toLocaleString('en-BD')}
          </div>

          {/* Seller */}
          {seller && (
            <div className="flex items-center gap-3 py-3 border-y border-white/5">
              <img src={seller.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.name)}&background=7C3AED&color=fff&size=40`}
                alt={seller.name} className="w-9 h-9 rounded-full object-cover ring-1 ring-violet-500/20" />
              <div>
                <p className="text-xs text-zinc-600">Sold by</p>
                <p className="text-sm font-medium text-zinc-200">{seller.sellerProfile?.shopName || seller.name}</p>
              </div>
            </div>
          )}

          {/* Low stock warning */}
          {isLowStock && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Hurry — only {stock} left in stock!
            </motion.div>
          )}

          {/* Seller replaced warning */}
          <AnimatePresence>
            {replacedSeller && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-2.5">
                Cart cleared — items from different seller removed.
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quantity + Add to Cart */}
          {!isOutOfStock ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-white/10 rounded-xl overflow-hidden bg-surface-2">
                <button onClick={() => setQuantity(q => Math.max(1, q-1))}
                  className="px-3 py-2 text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition text-lg">−</button>
                <span className="px-4 py-2 font-semibold text-zinc-200 min-w-[2.5rem] text-center">{quantity}</span>
                <button onClick={() => setQuantity(q => Math.min(maxQty, q+1))}
                  className="px-3 py-2 text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition text-lg">+</button>
              </div>

              <AnimatePresence mode="wait">
                {cartFeedback ? (
                  <motion.button key="added" initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                    className="flex-1 py-3 rounded-xl bg-emerald-400/20 border border-emerald-400/30 text-emerald-400 font-semibold flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Added to Cart!
                  </motion.button>
                ) : (
                  <motion.button key="add" onClick={handleAddToCart} whileTap={{ scale: 0.97 }}
                    className="flex-1 py-3 rounded-xl btn-primary">
                    Add to Cart — ৳{(price * quantity).toLocaleString('en-BD')}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button disabled
              className="w-full py-3 rounded-xl bg-surface-2 border border-white/5 text-zinc-600 font-semibold cursor-not-allowed">
              Out of Stock — Check back later
            </button>
          )}

          {/* Description */}
          <div className="pt-2">
            <p className="text-sm font-semibold text-zinc-300 mb-1">About this product</p>
            <p className="text-sm text-zinc-500 whitespace-pre-line leading-relaxed">{description}</p>
          </div>

          {/* Tags */}
          {tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span key={tag} className="text-xs bg-surface-2 border border-white/8 text-zinc-600 px-3 py-1 rounded-full capitalize">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reviews section */}
      {product && (
        <section className="mb-16 space-y-6">
          <div className="glow-divider" />
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-100">
              Customer Reviews
              {product.reviewCount > 0 && (
                <span className="ml-2 text-base font-normal text-zinc-600">({product.reviewCount})</span>
              )}
            </h2>
          </div>

          {/* Write a review — verified buyers only */}
          <WriteReview productId={product._id} onSubmitted={() => window.location.reload()} />

          <ReviewSection productId={product._id} avgRating={product.rating}
            reviewCount={product.reviewCount} sellerId={product.seller?._id || product.seller} />
        </section>
      )}

      {/* Q&A section */}
      {product && (
        <section className="mb-16 space-y-4">
          <div className="glow-divider" />
          <QASection productId={product._id} sellerId={product.seller?._id || product.seller} />
        </section>
      )}

      {/* Related products */}
      {related?.length > 0 && (
        <section>
          <div className="glow-divider mb-6" />
          <h2 className="text-xl font-bold text-zinc-100 mb-5">Related Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {related.map(p => <ProductCard key={p._id} product={p} showSeller={false} />)}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetail;
