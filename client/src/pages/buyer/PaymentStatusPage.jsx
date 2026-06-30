import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const PaymentStatusPage = () => {
  const location = useLocation();
  const isSuccess = location.pathname.includes('success');

  // Simple unmount/mount effect for confetti-like particles
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (isSuccess) {
      const newParticles = Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        scale: Math.random() * 1.5 + 0.5,
        rotation: Math.random() * 360,
      }));
      setParticles(newParticles);
    }
  }, [isSuccess]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center relative overflow-hidden px-4">
      
      {/* Background glow */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[100px] pointer-events-none opacity-20
                      ${isSuccess ? 'bg-emerald-500' : 'bg-rose-500'}`} />

      {/* Confetti Particles */}
      {isSuccess && particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute w-2 h-2 rounded-full bg-emerald-400"
          initial={{ top: '100%', left: `${p.x}%`, scale: 0, rotate: 0, opacity: 1 }}
          animate={{
            top: `${p.y}%`,
            scale: p.scale,
            rotate: p.rotation,
            opacity: 0,
          }}
          transition={{ duration: 2 + Math.random() * 2, ease: "easeOut", delay: Math.random() * 0.5 }}
        />
      ))}

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="card-glass rounded-3xl p-10 max-w-md w-full text-center relative z-10 border border-white/10"
      >
        
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl border shadow-xl
                        ${isSuccess 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/20' 
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-500/20'}`}
          >
            {isSuccess ? '🎉' : '❌'}
          </motion.div>
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-3">
          {isSuccess ? 'Congratulations!' : 'Payment Failed'}
        </h1>
        
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
          {isSuccess 
            ? "Your transaction with SSLCommerz was successful. The funds have been securely added to your TrustTrade BD wallet." 
            : "We couldn't process your payment. It might have been cancelled or the transaction was declined. No funds were deducted."}
        </p>

        <div className="space-y-3">
          <Link to="/wallet" className="btn-primary w-full py-3.5 text-base font-semibold block">
            {isSuccess ? 'View Wallet Balance' : 'Try Again'}
          </Link>
          <Link to="/" className="block text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors py-2">
            Back to Home
          </Link>
        </div>

      </motion.div>
    </div>
  );
};

export default PaymentStatusPage;
