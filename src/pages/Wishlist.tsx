import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import ProductCard from '../components/ProductCard';

export default function Wishlist() {
  const { items } = useWishlist();

  if (items.length === 0) {
    return (
      <div className="section-padding py-20 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto">
          <div className="w-24 h-24 rounded-full glass flex items-center justify-center mx-auto mb-6">
            <Heart className="w-10 h-10 text-ink-500" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white mb-3">Your Wishlist is Empty</h1>
          <p className="text-ink-400 mb-8">Save items you love for later.</p>
          <Link to="/shop" className="btn-gold rounded-full px-8 py-3.5 text-sm uppercase tracking-widest inline-flex items-center gap-2 group">
            Browse Products <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="section-padding py-8 lg:py-12">
      <h1 className="font-display text-3xl lg:text-4xl font-bold text-white mb-8">My Wishlist</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {items.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </div>
    </div>
  );
}
