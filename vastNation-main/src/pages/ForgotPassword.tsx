import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowRight } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setSent(true);
      setLoading(false);
      toast('Password reset link sent to your email');
    }, 1000);
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center section-padding py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="glass rounded-3xl p-8">
          <div className="text-center mb-8">
            <Link to="/" className="font-display text-2xl font-bold text-white inline-block mb-2">
              VAST<span className="text-gold-400">NATION</span>
            </Link>
            <h1 className="font-display text-3xl font-bold text-white">Reset Password</h1>
            <p className="text-ink-400 text-sm mt-2">
              {sent ? 'Check your email for a reset link' : 'Enter your email to receive a reset link'}
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-10"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-gold rounded-lg w-full py-3.5 text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-ink-300 text-sm mb-6">We've sent a password reset link to <span className="text-white font-medium">{email}</span></p>
              <Link to="/login" className="btn-outline rounded-lg px-6 py-3 text-sm uppercase tracking-wider inline-block">
                Back to Login
              </Link>
            </div>
          )}

          <p className="text-center text-sm text-ink-400 mt-6">
            Remember your password?{' '}
            <Link to="/login" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
