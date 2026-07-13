import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../../api/adminApi';

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  
  const [platformFeePercent, setPlatformFeePercent] = useState(2.5);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.getSettings();
      if (data?.data?.settings) {
        setPlatformFeePercent(data.data.settings.platformFeePercent || 2.5);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const { data } = await adminApi.updateSettings({
        platformFeePercent: parseFloat(platformFeePercent)
      });
      setFeedback({ type: 'success', msg: data.message || 'Settings saved successfully.' });
      if (data?.data?.settings) {
        setPlatformFeePercent(data.data.settings.platformFeePercent);
      }
    } catch (err) {
      setFeedback({ type: 'error', msg: err.response?.data?.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="section-label mb-1">Admin Tools</p>
        <h1 className="text-2xl font-bold text-zinc-100">System Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Configure global platform variables like fees and charges.
        </p>
      </div>

      {loading ? (
        <div className="h-48 bg-surface-2 rounded-2xl animate-pulse" />
      ) : (
        <motion.div
          layout
          className="card rounded-2xl p-6"
        >
          <form onSubmit={handleSave} className="space-y-6">
            
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-zinc-200">Financial Settings</h2>
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-400">
                  TrustTrade Platform Fee (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={platformFeePercent}
                    onChange={(e) => setPlatformFeePercent(e.target.value)}
                    className="input-field pr-12 w-full max-w-md"
                    placeholder="2.5"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-zinc-500 sm:text-sm" style={{ right: 'calc(100% - 28rem)' }}>
                      %
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500">
                  This percentage is automatically deducted from the seller's earnings when an order is successfully completed.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <AnimatePresence mode="wait">
                {feedback ? (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`text-sm font-medium ${
                      feedback.type === 'error' ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {feedback.msg}
                  </motion.p>
                ) : (
                  <div />
                )}
              </AnimatePresence>
              
              <button
                type="submit"
                disabled={saving}
                className="btn-primary px-6 py-2.5 text-sm"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
};

export default AdminSettings;
