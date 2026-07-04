import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { orderApi } from '../../api/orderApi';
import { walletApi } from '../../api/orderApi';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

// Lifted outside to prevent focus loss
const AddressField = ({ label, name, placeholder, required = true, address, setAddress, fieldErrors }) => (
  <div>
    <label className="block text-sm font-medium text-zinc-400 mb-1.5">
      {label}{' '}
      {!required && <span className="text-zinc-600 font-normal">(optional)</span>}
    </label>
    <input value={address[name]}
      onChange={e => setAddress(a => ({ ...a, [name]: e.target.value }))}
      placeholder={placeholder}
      className={`input ${fieldErrors[name] ? 'border-rose-500/50 focus:ring-rose-500/20' : ''}`} />
    {fieldErrors[name] && <p className="text-xs text-rose-400 mt-1">{fieldErrors[name]}</p>}
  </div>
);

const PlaceOrderPage = () => {
  const { user, refreshUser }               = useAuth();
  const { items: cartItems, totalAmount, clearCart } = useCart();
  const navigate                            = useNavigate();

  const [address, setAddress] = useState({
    fullName: user?.name || '', address: '', city: '',
    district: '', postalCode: '', phone: '',
  });
  const [wallet, setWallet]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [fieldErrors, setField] = useState({});

  useEffect(() => {
    if (cartItems.length === 0) navigate('/', { replace: true });
  }, [cartItems.length, navigate]);

  useEffect(() => {
    walletApi.getBalance().then(({ data }) => setWallet(data.data.wallet)).catch(() => {});
  }, []);

  const total     = totalAmount;
  const available = wallet?.availableBalance ?? 0;
  const hasFunds  = available >= total;

  const validate = () => {
    const e = {};
    if (!address.fullName.trim()) e.fullName = 'Full name is required.';
    if (!address.address.trim())  e.address  = 'Street address is required.';
    if (!address.city.trim())     e.city     = 'City is required.';
    if (!address.phone.trim())    e.phone    = 'Phone number is required.';
    setField(e); return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (!hasFunds) { setError(`Insufficient balance. You need ৳${total.toLocaleString('en-BD')} but have ৳${available.toLocaleString('en-BD')}.`); return; }
    setLoading(true); setError('');
    try {
      const { data } = await orderApi.place({
        items: cartItems.map(i => ({ productId: i._id, quantity: i.quantity })),
        shippingAddress: address,
      });
      clearCart(); await refreshUser();
      navigate(`/orders/${data.data.order._id}`, { replace: true, state: { justPlaced: true } });
    } catch (err) { setError(err.response?.data?.message || 'Failed to place order. Please try again.'); }
    finally { setLoading(false); }
  };

  const fp = { address, setAddress, fieldErrors };
  if (cartItems.length === 0) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="section-label mb-1">Buyer</p>
        <h1 className="text-2xl font-bold text-zinc-100">Checkout</h1>
        <p className="text-sm text-zinc-600 mt-0.5">Review your order and confirm shipping details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* Left — form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-5">
          <div className="card rounded-2xl p-6">
            <p className="section-label mb-4">Shipping Address</p>
            <div className="space-y-4">
              <AddressField label="Full name"     name="fullName"   placeholder="Rahim Uddin"              {...fp} />
              <AddressField label="Street address" name="address"   placeholder="House 12, Road 5, Block C" {...fp} />
              <div className="grid grid-cols-2 gap-4">
                <AddressField label="City"     name="city"     placeholder="Dhaka"  {...fp} />
                <AddressField label="District" name="district" placeholder="Dhaka"  required={false} {...fp} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <AddressField label="Postal code" name="postalCode" placeholder="1207"       required={false} {...fp} />
                <AddressField label="Phone"       name="phone"      placeholder="01XXXXXXXXX" {...fp} />
              </div>
            </div>
          </div>

          {/* Wallet status */}
          <div className={`rounded-2xl border px-5 py-4 transition-all
                          ${hasFunds
                            ? 'bg-emerald-400/8 border-emerald-400/20'
                            : 'bg-rose-500/8 border-rose-500/20'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-200">Wallet Balance</p>
                <p className={`text-xs mt-0.5 ${hasFunds ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {hasFunds ? 'Sufficient funds available'
                    : `Need ৳${(total - available).toLocaleString('en-BD')} more`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg text-zinc-100">৳{available.toLocaleString('en-BD')}</p>
                {!hasFunds && (
                  <Link to="/wallet" className="text-xs text-violet-400 hover:text-violet-300 transition">
                    Top up wallet →
                  </Link>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 text-sm">
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={loading || !hasFunds} className="btn-primary w-full py-3.5 text-base">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Placing order…
              </span>
            ) : ` Place Order · ৳${total.toLocaleString('en-BD')}`}
          </button>

          <p className="text-xs text-center text-zinc-600">
            Your payment is held securely in escrow until you confirm delivery.
          </p>
        </form>

        {/* Right — summary */}
        <div className="lg:col-span-2">
          <div className="card rounded-2xl p-5 sticky top-20">
            <p className="section-label mb-4">
              Order Summary ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})
            </p>
            <div className="space-y-3 mb-5">
              {cartItems.map(item => (
                <div key={item._id} className="flex items-center gap-3">
                  <img src={item.image || '/placeholder-product.jpg'} alt={item.title}
                    className="w-12 h-12 rounded-xl object-cover bg-surface-3 shrink-0"
                    onError={e => { e.target.src = '/placeholder-product.jpg'; }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 line-clamp-1">{item.title}</p>
                    <p className="text-xs text-zinc-600">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-zinc-100 shrink-0">
                    ৳{(item.price * item.quantity).toLocaleString('en-BD')}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-white/5 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Subtotal</span><span>৳{total.toLocaleString('en-BD')}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-400">
                <span>Escrow protection</span><span>Free</span>
              </div>
              <div className="flex justify-between font-bold text-zinc-100 text-base pt-2 border-t border-white/5">
                <span>Total</span><span>৳{total.toLocaleString('en-BD')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaceOrderPage;
