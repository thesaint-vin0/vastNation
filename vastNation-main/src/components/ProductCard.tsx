import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Eye, Star } from 'lucide-react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { formatNaira, discountPercent, classNames } from '../utils/helpers';

type Props = {
  product: Product;
  index?: number;
};

const badgeColors: Record<string, string> = {
  Sale: 'bg-red-500 text-white',
  New: 'bg-gold-400 text-ink-950',
  Limited: 'bg-ink-950 text-gold-400 border border-gold-400',
  Hot: 'bg-orange-500 text-white',
  Bestseller: 'bg-gold-400 text-ink-950',
};

export default function ProductCard({ product, index = 0 }: Props) {
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();
  const { toast } = useToast();
  const inWishlist = has(product.id);
  const discount = discountPercent(product.price, product.compare_at_price);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const size = product.sizes[0] ?? 'One Size';
    const color = product.colors[0] ?? 'Default';
    addItem(product, 1, size, color);
    toast(`${product.name} added to cart`);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product);
    toast(inWishlist ? 'Removed from wishlist' : 'Added to wishlist', 'info');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.08 }}
    >
      <Link to={`/product/${product.slug}`} className="group block">
        <div className="relative overflow-hidden rounded-2xl bg-ink-900 aspect-[3/4]">
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          {product.images[1] && (
            <img
              src={product.images[1]}
              alt={product.name}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.badge && (
              <span className={classNames('px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full', badgeColors[product.badge] ?? 'bg-gold-400 text-ink-950')}>
                {product.badge}
              </span>
            )}
            {discount > 0 && (
              <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-red-500 text-white">
                -{discount}%
              </span>
            )}
          </div>

          {/* Wishlist */}
          <button
            onClick={handleWishlist}
            className="absolute top-3 right-3 w-9 h-9 rounded-full glass-dark flex items-center justify-center transition-all duration-300 hover:scale-110"
            aria-label="Toggle wishlist"
          >
            <Heart className={classNames('w-4 h-4 transition-colors', inWishlist ? 'fill-gold-400 text-gold-400' : 'text-white')} />
          </button>

          {/* Quick actions */}
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-400">
            <div className="flex gap-2">
              <button
                onClick={handleQuickAdd}
                className="flex-1 btn-gold rounded-lg py-2.5 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                Quick Add
              </button>
              <div className="w-10 h-10 rounded-lg glass-dark flex items-center justify-center text-white">
                <Eye className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Stock indicator */}
          {product.stock <= 5 && product.stock > 0 && (
            <div className="absolute bottom-3 left-3 group-hover:opacity-0 transition-opacity">
              <span className="px-2 py-1 text-[10px] font-medium text-orange-300 glass-dark rounded-full">
                Only {product.stock} left
              </span>
            </div>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-ink-950/60 flex items-center justify-center">
              <span className="text-white font-semibold tracking-widest uppercase text-sm">Sold Out</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-gold-400 text-gold-400" />
            <span className="text-xs text-ink-400">{product.rating.toFixed(1)} ({product.review_count})</span>
          </div>
          <h3 className="text-sm font-medium text-white truncate group-hover:text-gold-400 transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{formatNaira(product.price)}</span>
            {product.compare_at_price && (
              <span className="text-xs text-ink-500 line-through">{formatNaira(product.compare_at_price)}</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
