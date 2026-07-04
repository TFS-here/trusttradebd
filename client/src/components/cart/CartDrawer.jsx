import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../context/CartContext';

const CartItem = ({ item }) => {
  const { updateQuantity, removeItem } = useCart();
  return (
    <div className="flex gap-3 py-4 border-b border-white/5 last:border-0">
      <img src={item.image || '/placeholder-product.jpg'} alt={item.title}
        className="w-16 h-16 rounded-xl object-cover bg-surface-3 shrink-0"
        onError={e => { e.target.src = '/placeholder-product.jpg'; }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-200 line-clamp-2 leading-snug">{item.title}</p>
        <p className="text-sm font-bold text-violet-400 mt-1">৳{item.price.toLocaleString('en-BD')}</p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center border border-white/10 rounded-lg overflow-hidden bg-surface-2">
            <button onClick={() => updateQuantity(item._id, item.quantity - 1)}
              className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition text-lg">−</button>
            <span className="w-8 text-center text-sm font-semibold text-zinc-200">{item.quantity}</span>
            <button onClick={() => updateQuantity(item._id, item.quantity + 1)}
              disabled={item.quantity >= item.stock}
              className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition text-lg">+</button>
          </div>
          <button onClick={() => removeItem(item._id)}
            className="text-xs text-zinc-600 hover:text-rose-400 transition">Remove</button>
        </div>
      </div>
      <p className="text-sm font-bold text-zinc-100 shrink-0 pt-0.5">
        ৳{(item.price * item.quantity).toLocaleString('en-BD')}
      </p>
    </div>
  );
};

const CartDrawer = ({ open, onClose }) => {
  const { items, totalItems, totalAmount, clearCart, sellerInfo } = useCart();
  const shopName = sellerInfo?.sellerProfile?.shopName || sellerInfo?.name || '';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="fixed right-0 top-0 h-full w-full max-w-sm z-50 flex flex-col
                       border-l border-white/5"
            style={{ background: 'linear-gradient(180deg, #111113 0%, #09090B 100%)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <h2 className="font-bold text-zinc-100 text-lg flex items-center gap-2">
                  Cart
                  {totalItems > 0 && (
                    <span className="text-xs font-bold text-white bg-violet-500 px-2 py-0.5 rounded-full">
                      {totalItems}
                    </span>
                  )}
                </h2>
                {shopName && <p className="text-xs text-zinc-600 mt-0.5">From {shopName}</p>}
              </div>
              <button onClick={onClose}
                className="p-2 rounded-xl text-zinc-600 hover:text-zinc-200 hover:bg-white/5 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-white/5 flex items-center justify-center text-3xl"><ShoppingCart className="inline w-5 h-5 mr-1 align-text-bottom" /></div>
                  <div>
                    <p className="font-semibold text-zinc-300">Your cart is empty</p>
                    <p className="text-sm text-zinc-600 mt-1">Add products to start shopping</p>
                  </div>
                  <button onClick={onClose} className="text-sm text-violet-400 hover:text-violet-300 transition font-medium">
                    Continue browsing →
                  </button>
                </div>
              ) : (
                items.map(item => <CartItem key={item._id} item={item} />)
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-white/5 px-5 py-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Subtotal ({totalItems} item{totalItems !== 1 ? 's' : ''})</span>
                  <span className="font-bold text-zinc-100 text-lg">৳{totalAmount.toLocaleString('en-BD')}</span>
                </div>
                <p className="text-xs text-emerald-400/80 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  Payment held in escrow until you confirm delivery
                </p>
                <Link to="/checkout" state={{ cartItems: items, totalAmount }} onClick={onClose}
                  className="btn-primary w-full py-3 text-center block text-center">
                  Proceed to Checkout
                </Link>
                <button onClick={clearCart}
                  className="w-full text-xs text-zinc-700 hover:text-rose-400 transition py-1">
                  Clear cart
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
