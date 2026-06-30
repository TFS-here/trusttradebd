import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import StockBadge from './StockBadge';

const ProductCard = ({ product, onAddToCart, showSeller = true }) => {
  const { _id, title, price, images, rating, reviewCount, stock, isActive, seller, category } = product;
  const isOutOfStock = stock === 0 || !isActive;
  const primaryImage = images?.[0] || '/placeholder-product.jpg';

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (!isOutOfStock && onAddToCart) onAddToCart(product);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!isOutOfStock ? { y: -4, transition: { duration: 0.2 } } : {}}
      className={`group relative bg-surface-1 border rounded-2xl overflow-hidden flex flex-col
                  transition-all duration-300
                  ${isOutOfStock
                    ? 'border-white/5 opacity-60'
                    : 'border-white/5 hover:border-violet-500/30 hover:shadow-card-hover'}`}
    >
      {/* Glow on hover */}
      {!isOutOfStock && (
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
             style={{ background: 'radial-gradient(circle at 50% 0%, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />
      )}

      {/* Image */}
      <Link to={`/products/${_id}`} className="relative block overflow-hidden aspect-square bg-surface-2">
        <img src={primaryImage} alt={title}
          className={`w-full h-full object-cover transition-transform duration-500
                      ${!isOutOfStock ? 'group-hover:scale-105' : ''}`}
          onError={e => { e.target.src = '/placeholder-product.jpg'; }} />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-1/60 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3">
          <StockBadge stock={stock} size="sm" />
        </div>
        <div className="absolute top-3 right-3">
          <span className="text-xs bg-black/50 backdrop-blur-sm text-zinc-300 px-2 py-0.5 rounded-full capitalize border border-white/10">
            {category}
          </span>
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {showSeller && seller && (
          <p className="text-xs text-zinc-600 truncate">
            {seller.sellerProfile?.shopName || seller.name}
          </p>
        )}

        <Link to={`/products/${_id}`}>
          <h3 className="text-sm font-semibold text-zinc-200 line-clamp-2 leading-snug
                         hover:text-violet-400 transition-colors duration-200">
            {title}
          </h3>
        </Link>

        {reviewCount > 0 && (
          <div className="flex items-center gap-1">
            <div className="flex">
              {[1,2,3,4,5].map(s => (
                <svg key={s} className={`w-3 h-3 ${s <= Math.round(rating) ? 'text-amber-400' : 'text-zinc-700'}`}
                     fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-xs text-zinc-600">({reviewCount})</span>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-lg font-bold text-zinc-100">
            ৳{price.toLocaleString('en-BD')}
          </span>
          <button onClick={handleAddToCart} disabled={isOutOfStock}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all duration-200
                        ${isOutOfStock
                          ? 'bg-white/5 text-zinc-600 cursor-not-allowed'
                          : 'bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30 hover:text-violet-300 active:scale-95'}`}>
            {isOutOfStock ? 'Unavailable' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
