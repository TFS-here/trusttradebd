import { Siren } from 'lucide-react';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '/api';

/**
 * DisputeForm
 * ─────────────────────────────────────────────────────────────────
 * Buyer submits a dispute with:
 *   - A written reason
 *   - An unboxing video file (uploaded to Cloudinary via /api/upload/video)
 *
 * Props:
 *   orderId    — the Order._id
 *   onSuccess  — called after successful submission
 *   onCancel   — called when buyer closes the form
 */
const DisputeForm = ({ orderId, onSuccess, onCancel }) => {
  const [reason, setReason]         = useState('');
  const [videoFile, setVideoFile]   = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const fileRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setError('Video must be under 100MB.');
      return;
    }
    setVideoFile(file);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Please describe the problem.'); return; }
    if (!videoFile)     { setError('An unboxing video is required as proof.'); return; }

    setError('');
    const token = localStorage.getItem('tt_token');

    try {
      // Step 1: Upload video to Cloudinary
      setUploading(true);
      const formData = new FormData();
      formData.append('video', videoFile);
      const uploadRes = await axios.post(`${API}/upload/video`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      const videoUrl = uploadRes.data.data.url;
      setUploading(false);

      // Step 2: Submit dispute
      setSubmitting(true);
      await axios.post(`${API}/disputes`, { orderId, reason, unboxingVideoUrl: videoUrl }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      onSuccess();
    } catch (err) {
      setUploading(false);
      setSubmitting(false);
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="card-glass rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5"
      >
        {/* Header */}
        <div>
          <h3 className="text-lg font-bold text-zinc-100"><Siren className="inline w-5 h-5 mr-1 align-text-bottom" /> Raise a Problem</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Describe the issue and upload your unboxing video. Without a video, disputes cannot be accepted.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              What's the problem?
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe clearly: wrong item, damaged product, missing parts…"
              rows={4}
              className="input resize-none"
              disabled={submitting || uploading}
            />
          </div>

          {/* Video upload */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Unboxing Video (Required — max 100MB)
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition
                ${videoFile
                  ? 'border-violet-500/40 bg-violet-500/5'
                  : 'border-white/10 hover:border-violet-500/30 hover:bg-violet-500/5'}`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska"
                onChange={handleFileChange}
                className="hidden"
              />
              {videoFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-violet-400"> {videoFile.name}</p>
                  <p className="text-xs text-zinc-600">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  <p className="text-xs text-zinc-500">Click to change</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-3xl"></div>
                  <p className="text-sm text-zinc-400">Click to select your unboxing video</p>
                  <p className="text-xs text-zinc-600">MP4, MOV, WebM — up to 100MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Uploading video…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-violet-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Warning box */}
          <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 text-xs text-amber-400 leading-relaxed">
             Your payment will be <strong>held</strong> while we review your dispute. Our admin will watch your unboxing video and decide within 24–72 hours.
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={uploading || submitting}
              className="flex-1 btn-secondary py-2.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || submitting}
              className="flex-1 btn-danger py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {uploading ? `Uploading ${uploadProgress}%…`
                : submitting ? 'Submitting…'
                : 'Submit Dispute'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default DisputeForm;
