import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { productApi } from '../../api/productApi';

const CATEGORIES = [
  { value: 'electronics', label: '📱 Electronics' },
  { value: 'clothing',    label: '👕 Clothing' },
  { value: 'books',       label: '📚 Books' },
  { value: 'home',        label: '🏠 Home' },
  { value: 'sports',      label: '⚽ Sports' },
  { value: 'beauty',      label: '💄 Beauty' },
  { value: 'food',        label: '🍜 Food' },
  { value: 'toys',        label: '🧸 Toys' },
  { value: 'automotive',  label: '🚗 Automotive' },
  { value: 'other',       label: '📦 Other' },
];

// Lifted out to prevent focus loss
const FormField = ({ label, error, required, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-zinc-400 mb-1.5">
      {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
    {children}
    {hint && !error && <p className="text-xs text-zinc-600 mt-1">{hint}</p>}
    {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
  </div>
);

const ImageInput = ({ index, value, onChange, onRemove }) => (
  <div className="flex gap-2">
    <input type="url" value={value} onChange={e => onChange(index, e.target.value)}
      placeholder={`Image URL ${index + 1}`} className="input flex-1" />
    {index > 0 && (
      <button type="button" onClick={() => onRemove(index)}
        className="px-3 py-2 rounded-xl border border-white/8 text-zinc-600 hover:border-rose-500/30 hover:text-rose-400 transition shrink-0">
        ✕
      </button>
    )}
  </div>
);

const CreateProductPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title:'', description:'', price:'', stock:'', category:'', tags:'' });
  const [images, setImages]   = useState(['']);
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));
  const updateImage = (i, val) => setImages(p => p.map((v, idx) => idx === i ? val : v));
  const addImage    = () => { if (images.length < 8) setImages(p => [...p, '']); };
  const removeImage = i => setImages(p => p.filter((_, idx) => idx !== i));

  const validate = () => {
    const e = {};
    if (!form.title.trim() || form.title.trim().length < 3) e.title = 'Title must be at least 3 characters.';
    if (!form.description.trim() || form.description.trim().length < 10) e.description = 'Description must be at least 10 characters.';
    if (!form.price || isNaN(form.price) || Number(form.price) <= 0) e.price = 'Enter a valid price greater than 0.';
    if (form.stock === '' || isNaN(form.stock) || Number(form.stock) < 0) e.stock = 'Enter a valid stock quantity (0 or more).';
    if (!form.category) e.category = 'Please select a category.';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); setApiError('');
    try {
      const { data } = await productApi.create({
        title: form.title.trim(), description: form.description.trim(),
        price: Number(form.price), stock: parseInt(form.stock, 10),
        category: form.category,
        images: images.map(u => u.trim()).filter(Boolean),
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      navigate(`/products/${data.data.product._id}`, { replace: true });
    } catch (err) { setApiError(err.response?.data?.message || 'Failed to create product.'); }
    finally { setLoading(false); }
  };

  const previewUrl = images.find(u => u.trim()) || null;

  // Checklist
  const checks = [
    { label: 'Title',       done: form.title.trim().length >= 3 },
    { label: 'Description', done: form.description.trim().length >= 10 },
    { label: 'Price',       done: !!form.price && Number(form.price) > 0 },
    { label: 'Stock',       done: form.stock !== '' && Number(form.stock) >= 0 },
    { label: 'Category',    done: !!form.category },
    { label: 'Image',       done: images.some(u => u.trim()) },
  ];
  const allDone = checks.every(c => c.done);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/seller/products"
          className="p-2 rounded-xl border border-white/8 text-zinc-600 hover:text-zinc-300 hover:border-white/20 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <p className="section-label mb-0.5">Seller</p>
          <h1 className="text-2xl font-bold text-zinc-100">New Product</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left — main details */}
          <div className="lg:col-span-2 space-y-5">

            {/* Basic info */}
            <div className="card rounded-2xl p-6 space-y-5">
              <p className="section-label">Basic Information</p>
              <FormField label="Product title" error={errors.title} required>
                <input type="text" className={`input ${errors.title ? 'border-rose-500/50' : ''}`}
                  placeholder="e.g. Wireless Bluetooth Headphones"
                  value={form.title} onChange={set('title')} maxLength={120} />
              </FormField>
              <FormField label="Description" error={errors.description} required
                hint="Describe condition, features, what's included. Min 10 characters.">
                <textarea rows={5} className={`input resize-none ${errors.description ? 'border-rose-500/50' : ''}`}
                  placeholder="Describe your product in detail…"
                  value={form.description} onChange={set('description')} maxLength={2000} />
                <p className="text-xs text-zinc-600 mt-1 text-right">{form.description.length} / 2000</p>
              </FormField>
              <FormField label="Category" error={errors.category} required>
                <select className={`input ${errors.category ? 'border-rose-500/50' : ''}`}
                  value={form.category} onChange={set('category')}>
                  <option value="">Select a category…</option>
                  {CATEGORIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </FormField>
              <FormField label="Tags" hint="Comma-separated keywords to help buyers find your product">
                <input type="text" className="input" placeholder="e.g. wireless, bluetooth, noise-cancelling"
                  value={form.tags} onChange={set('tags')} />
              </FormField>
            </div>

            {/* Pricing */}
            <div className="card rounded-2xl p-6 space-y-5">
              <p className="section-label">Pricing & Stock</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Price (৳)" error={errors.price} required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 font-medium">৳</span>
                    <input type="number" min="0.01" step="0.01"
                      className={`input pl-8 ${errors.price ? 'border-rose-500/50' : ''}`}
                      placeholder="0.00" value={form.price} onChange={set('price')} />
                  </div>
                </FormField>
                <FormField label="Stock quantity" error={errors.stock} required hint="Units available to sell">
                  <input type="number" min="0" step="1"
                    className={`input ${errors.stock ? 'border-rose-500/50' : ''}`}
                    placeholder="e.g. 10" value={form.stock} onChange={set('stock')} />
                </FormField>
              </div>
              {form.price && !isNaN(form.price) && Number(form.price) > 0 && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-violet-400 font-medium mb-0.5">Buyers will see</p>
                  <p className="text-2xl font-extrabold text-violet-300">৳{Number(form.price).toLocaleString('en-BD')}</p>
                </motion.div>
              )}
            </div>

            {/* Images */}
            <div className="card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="section-label">Product Images</p>
                <span className="text-xs text-zinc-600">{images.filter(Boolean).length} / 8</span>
              </div>
              <p className="text-xs text-zinc-600">Paste image URLs. First image is the cover photo.</p>
              <div className="space-y-2">
                {images.map((url, i) => <ImageInput key={i} index={i} value={url} onChange={updateImage} onRemove={removeImage} />)}
              </div>
              {images.length < 8 && (
                <button type="button" onClick={addImage}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-white/8
                             text-sm text-zinc-600 hover:border-violet-500/30 hover:text-violet-400
                             transition flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add another image
                </button>
              )}
            </div>
          </div>

          {/* Right — preview + checklist */}
          <div className="space-y-4">
            {/* Preview */}
            <div className="card rounded-2xl p-4">
              <p className="section-label mb-3">Cover preview</p>
              <div className="aspect-square rounded-xl overflow-hidden bg-surface-3 border border-white/5 flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover"
                    onError={e => { e.target.style.display='none'; }} />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-700 gap-2">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <p className="text-xs">No image yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Checklist */}
            <div className="card rounded-2xl p-4">
              <p className="section-label mb-3">Listing checklist</p>
              <div className="space-y-2">
                {checks.map(({ label, done }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all
                                     ${done ? 'bg-emerald-400/20 border border-emerald-400/30' : 'bg-surface-3 border border-white/8'}`}>
                      {done && (
                        <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm transition-colors ${done ? 'text-zinc-300' : 'text-zinc-600'}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {apiError && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 text-sm">
                  {apiError}
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading || !allDone}
              className="btn-primary w-full py-3 disabled:opacity-40">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Publishing…
                </span>
              ) : 'Publish product'}
            </button>
            <Link to="/seller/products"
              className="block text-center text-sm text-zinc-600 hover:text-zinc-400 transition">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateProductPage;
