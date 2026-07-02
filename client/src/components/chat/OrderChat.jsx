import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatApi } from '../../api/chatApi';
import { useAuth } from '../../context/AuthContext';

const POLL_INTERVAL = 4000; // 4 seconds

const OrderChat = ({ orderId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef(null);
  const lastCountRef = useRef(0);

  // ── Browser Notifications Permission ─────────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Fetch Messages ─────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await chatApi.getMessages(orderId);
      const msgs = data.data || [];
      
      // Check for new messages when chat is closed
      if (!isOpen && msgs.length > lastCountRef.current) {
        const newCount = msgs.length - lastCountRef.current;
        setUnread(newCount);
        
        // Trigger browser notification
        if ('Notification' in window && Notification.permission === 'granted' && newCount > 0) {
          const latestMsg = msgs[msgs.length - 1];
          const notifText = latestMsg.text || 'Sent an image';
          new Notification('New message in TrustTrade', {
            body: notifText,
            icon: '/favicon.ico' // Or any suitable icon
          });
        }
      }
      
      setMessages(msgs);
    } catch {
      // Silent fail on polling
    }
  }, [orderId, isOpen]);

  // Initial fetch + polling
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Auto-scroll to bottom when messages change and chat is open
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Clear unread when chat opens
  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      lastCountRef.current = messages.length;
    }
  }, [isOpen, messages.length]);

  // ── Send Message ───────────────────────────────────────────────
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !imageFile) || sending) return;

    setSending(true);
    setError('');

    try {
      let attachmentUrl = '';

      if (imageFile) {
        // Upload image first
        const formData = new FormData();
        formData.append('image', imageFile);
        
        const token = localStorage.getItem('tt_token');
        const uploadRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        
        const uploadData = await uploadRes.json();
        if (uploadData.status !== 'success') {
          throw new Error('Image upload failed');
        }
        attachmentUrl = uploadData.data.url;
      }

      await chatApi.sendMessage({ 
        orderId, 
        text: text.trim() || (attachmentUrl ? '📷 Image' : ''), 
        attachmentUrl 
      });
      
      setText('');
      setImageFile(null);
      await fetchMessages();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-BD', { day: 'numeric', month: 'short' });
  };

  // Group messages by day
  const groupedMessages = messages.reduce((acc, msg) => {
    const dateKey = new Date(msg.createdAt).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(msg);
    return acc;
  }, {});

  return (
    <>
      {/* ── Floating Chat Toggle Button ─────────────────────────── */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-violet-600 hover:bg-violet-500 
                   shadow-lg shadow-violet-500/25 flex items-center justify-center transition-colors"
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        {/* Unread badge */}
        <AnimatePresence>
          {unread > 0 && !isOpen && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full text-[10px] 
                         font-bold text-white flex items-center justify-center ring-2 ring-[#09090B]"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Chat Panel ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-40 w-[360px] max-w-[calc(100vw-2rem)]
                       bg-surface-1 border border-white/10 rounded-2xl shadow-2xl shadow-black/50
                       flex flex-col overflow-hidden"
            style={{ height: '480px' }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 bg-surface-2/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-200">Order Chat</p>
                <p className="text-[11px] text-zinc-600 truncate">Secure · Messages are monitored</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Live polling active" />
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scroll-smooth">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-violet-400/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-500">No messages yet</p>
                  <p className="text-xs text-zinc-700 mt-1">Start the conversation about this order</p>
                </div>
              ) : (
                Object.entries(groupedMessages).map(([dateKey, msgs]) => (
                  <div key={dateKey}>
                    {/* Date Separator */}
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-white/5" />
                      <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
                        {formatDate(msgs[0].createdAt)}
                      </span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>
                    {msgs.map((msg) => {
                      const isMe = msg.sender === user?._id || msg.sender?._id === user?._id;
                      return (
                        <motion.div
                          key={msg._id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed
                              ${isMe
                                ? 'bg-violet-600 text-white rounded-br-md'
                                : 'bg-surface-3 text-zinc-300 rounded-bl-md border border-white/5'
                              }`}
                          >
                            {msg.attachmentUrl && (
                              <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={msg.attachmentUrl} 
                                  alt="Attachment" 
                                  className="w-48 h-auto rounded-lg mb-2 object-cover border border-white/10"
                                />
                              </a>
                            )}
                            <p className="break-words whitespace-pre-wrap">{msg.text}</p>
                            <p className={`text-[10px] mt-1 ${isMe ? 'text-violet-200/60' : 'text-zinc-600'}`}>
                              {formatTime(msg.createdAt)}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Error Banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/20 text-rose-400 text-xs overflow-hidden"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Image Preview */}
            <AnimatePresence>
              {imageFile && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 py-2 bg-surface-2 border-t border-white/5 flex items-center gap-3 overflow-hidden"
                >
                  <div className="relative">
                    <img 
                      src={URL.createObjectURL(imageFile)} 
                      alt="Preview" 
                      className="w-12 h-12 object-cover rounded-lg border border-white/10"
                    />
                    <button 
                      type="button"
                      onClick={() => setImageFile(null)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-lg"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 truncate flex-1">{imageFile.name}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Area */}
            <form onSubmit={handleSend} className="px-3 py-2.5 border-t border-white/5 bg-surface-2/30 flex items-center gap-2">
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={(e) => {
                  if (e.target.files[0]) setImageFile(e.target.files[0]);
                }} 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                className="w-10 h-10 rounded-xl bg-surface-3/50 hover:bg-surface-3 border border-white/5 
                           text-zinc-400 hover:text-violet-400 disabled:opacity-40 
                           flex items-center justify-center transition-colors shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              
              <input
                type="text"
                value={text}
                onChange={(e) => { setText(e.target.value); setError(''); }}
                placeholder="Type a message..."
                maxLength={1000}
                className="flex-1 bg-surface-3/50 border border-white/5 rounded-xl px-3.5 py-2.5 text-sm 
                           text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40
                           transition-colors"
              />
              <button
                type="submit"
                disabled={(!text.trim() && !imageFile) || sending}
                className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 
                           disabled:hover:bg-violet-600 flex items-center justify-center transition-colors shrink-0"
              >
                {sending ? (
                  <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OrderChat;
