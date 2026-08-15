import { Link } from 'react-router-dom';
import { Instagram, Twitter, Facebook, Mail, Phone, MapPin, ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { subscribeNewsletter } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

export default function Footer() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await subscribeNewsletter(email.trim());
      toast('Subscribed successfully!');
      setEmail('');
    } catch {
      toast('You are already subscribed!', 'info');
    } finally {
      setLoading(false);
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="bg-ink-950 border-t border-white/5 mt-20">
      {/* Newsletter */}
      <div className="section-padding py-16 border-b border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-bold text-white mb-3">
            Join the <span className="text-gradient-gold">Nation</span>
          </h2>
          <p className="text-ink-400 mb-8">
            Subscribe for early access to drops, exclusive offers, and members-only content.
          </p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="input-field flex-1"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-gold rounded-lg px-8 py-3 text-sm uppercase tracking-wider whitespace-nowrap disabled:opacity-50"
            >
              {loading ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        </div>
      </div>

      {/* Links */}
      <div className="section-padding py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="font-display text-2xl font-bold text-white mb-4 block">
              VAST<span className="text-gold-400">NATION</span>
            </Link>
            <p className="text-sm text-ink-400 mb-6 max-w-xs">
              Wear Your Identity. Premium streetwear for the confident, ambitious, and individual.
            </p>
            <div className="flex gap-3">
              {[Instagram, Twitter, Facebook].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-full glass flex items-center justify-center text-ink-300 hover:text-gold-400 hover:border-gold-400/40 transition-all"
                  aria-label="Social link"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-4">Shop</h4>
            <ul className="space-y-2.5 text-sm text-ink-400">
              <li><Link to="/shop" className="hover:text-white transition-colors">All Products</Link></li>
              <li><Link to="/shop?category=men" className="hover:text-white transition-colors">Men</Link></li>
              <li><Link to="/shop?category=women" className="hover:text-white transition-colors">Women</Link></li>
              <li><Link to="/shop?category=hoodies" className="hover:text-white transition-colors">Hoodies</Link></li>
              <li><Link to="/shop?category=sneakers" className="hover:text-white transition-colors">Sneakers</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm text-ink-400">
              <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link to="/shop" className="hover:text-white transition-colors">New Arrivals</Link></li>
              <li><Link to="/shop?sort=rating" className="hover:text-white transition-colors">Best Sellers</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-4">Contact</h4>
            <ul className="space-y-2.5 text-sm text-ink-400">
              <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-gold-400" /> hello@vastnation.com</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-gold-400" /> +234 800 VAST NATION</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gold-400" /> Lagos, Nigeria</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-white/5 py-6">
        <div className="section-padding flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-500">
          <p>&copy; {new Date().getFullYear()} Vast Nation. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-gold-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gold-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-gold-400 transition-colors">Shipping Info</a>
          </div>
        </div>
      </div>

      {/* Back to top */}
      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={scrollToTop}
            className="fixed bottom-6 left-6 z-50 w-11 h-11 rounded-full btn-gold flex items-center justify-center shadow-xl"
            aria-label="Back to top"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </footer>
  );
}
