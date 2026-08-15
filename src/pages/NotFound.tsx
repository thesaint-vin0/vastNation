import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center section-padding">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="font-display text-8xl lg:text-9xl font-bold text-gradient-gold mb-4">404</h1>
        <p className="text-xl text-white mb-2">Page Not Found</p>
        <p className="text-ink-400 mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="btn-gold rounded-full px-8 py-3.5 text-sm uppercase tracking-widest inline-flex items-center gap-2">
          <Home className="w-4 h-4" /> Back Home
        </Link>
      </motion.div>
    </div>
  );
}
