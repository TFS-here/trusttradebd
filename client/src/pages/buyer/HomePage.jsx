import { Search } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProducts } from '../../hooks/useProduct';
import { useCart } from '../../context/CartContext';
import ProductCard from '../../components/product/ProductCard';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'electronics',  label: ' Electronics' },
  { value: 'clothing',     label: ' Clothing' },
  { value: 'books',        label: ' Books' },
  { value: 'home',         label: ' Home' },
  { value: 'sports',       label: ' Sports' },
  { value: 'beauty',       label: ' Beauty' },
  { value: 'food',         label: ' Food' },
  { value: 'toys',         label: ' Toys' },
  { value: 'automotive',   label: ' Automotive' },
  { value: 'other',        label: ' Other' },
];

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'price_asc',  label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating',     label: 'Top rated' },
  { value: 'popular',    label: 'Most reviewed' },
];

const HomePage = () => {
  const [searchInput, setInput]   = useState('');
  const [category, setCategory]   = useState('');
  const [sort, setSort]           = useState('newest');
  const [inStockOnly, setInStock] = useState(false);
  const [cartMsg, setCartMsg]     = useState('');

  const { addItem } = useCart();
  const { products, pagination, loading, error, setParams } = useProducts({ sort });

  const handleSearch = (e) => {
    e.preventDefault();
    setParams(p => ({ ...p, search: searchInput, page: 1 }));
  };

  const handleCategory = (cat) => {
    setCategory(cat);
    setParams(p => ({ ...p, category: cat, page: 1 }));
  };

  const handleSort = (s) => {
    setSort(s);
    setParams(p => ({ ...p, sort: s, page: 1 }));
  };

  const handleAddToCart = (product) => {
    const { replaced } = addItem(product, 1);
    setCartMsg(replaced
      ? `Cart cleared — "${product.title}" added (different seller)`
      : `"${product.title}" added to cart!`);
    setTimeout(() => setCartMsg(''), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-surface-1 to-surface-1" />
        <div className="absolute top-0 left-0 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />

        <div className="relative px-6 py-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="section-label mb-3">Secure P2P Marketplace</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-2">
              Buy & Sell with{' '}
              <span className="text-gradient">Confidence</span>
            </h1>
            <p className="text-zinc-500 mb-6 text-sm max-w-md mx-auto">
              Every transaction protected by escrow — pay only when you receive
            </p>
          </motion.div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex max-w-xl mx-auto gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input value={searchInput} onChange={e => setInput(e.target.value)}
                placeholder="Search products…"
                className="w-full bg-white/5 border border-white/10 text-zinc-100
                           placeholder-zinc-600 rounded-xl pl-10 pr-4 py-2.5 text-sm
                           focus:outline-none focus:border-violet-500/60 focus:ring-2
                           focus:ring-violet-500/20 transition-all backdrop-blur-sm" />
            </div>
            <button type="submit" className="btn-primary px-5 py-2.5 shrink-0">Search</button>
          </form>
        </div>
      </div>

      {/* ── Category pills ────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {CATEGORIES.map(({ value, label }) => (
          <button key={value} onClick={() => handleCategory(value)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200
                        ${category === value
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40 shadow-glow-violet/20'
                          : 'bg-surface-2 text-zinc-500 border border-white/5 hover:border-violet-500/20 hover:text-zinc-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Filter row ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {pagination && (
            <p className="text-sm text-zinc-600">
              <span className="text-zinc-400 font-medium">{pagination.total.toLocaleString()}</span> products
            </p>
          )}
          <label className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer select-none">
            <input type="checkbox" checked={inStockOnly}
              onChange={e => { setInStock(e.target.checked); setParams(p => ({ ...p, inStock: e.target.checked ? 'true' : '', page: 1 })); }}
              className="rounded accent-violet-500" />
            In stock only
          </label>
        </div>
        <select value={sort} onChange={e => handleSort(e.target.value)}
          className="bg-surface-2 border border-white/8 text-zinc-400 text-sm rounded-xl px-3 py-2
                     focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20">
          {SORT_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {/* ── Loading skeleton ──────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-1 border border-white/5 aspect-[3/4] skeleton" />
          ))}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="text-center py-12">
          <p className="text-zinc-600">{error}</p>
        </div>
      )}

      {/* ── Product grid ──────────────────────────────────────── */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map(p => (
            <ProductCard key={p._id} product={p} onAddToCart={handleAddToCart} />
          ))}
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────────── */}
      {!loading && !error && products.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-white/5 flex items-center justify-center text-3xl mx-auto mb-4"><Search className="inline w-5 h-5 mr-1 align-text-bottom" /></div>
          <h3 className="font-semibold text-zinc-400 text-lg">No products found</h3>
          <p className="text-zinc-600 text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────── */}
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button onClick={() => setParams(p => ({ ...p, page: Math.max(1, (p.page||1) - 1) }))}
            disabled={!pagination.hasPrev}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-30">← Previous</button>
          <span className="px-4 py-2 text-sm text-zinc-600">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button onClick={() => setParams(p => ({ ...p, page: Math.min(pagination.pages, (p.page||1) + 1) }))}
            disabled={!pagination.hasNext}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-30">Next →</button>
        </div>
      )}

      {/* ── Cart toast ────────────────────────────────────────── */}
      <AnimatePresence>
        {cartMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                       bg-surface-2 border border-violet-500/30 text-zinc-200 text-sm font-medium
                       px-5 py-3 rounded-2xl shadow-glow-violet/20 whitespace-nowrap backdrop-blur-md"
          >
            {cartMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomePage;
