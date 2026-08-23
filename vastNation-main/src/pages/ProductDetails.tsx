import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Star, ShoppingBag, Zap, Minus, Plus, Truck, Shield, RefreshCw, ChevronRight } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import ProductSkeleton from '../components/ProductSkeleton';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getProductBySlug, getRelatedProducts, getReviews, addReview } from '../services/api';
import { supabase } from '../lib/supabase';
import { formatNaira, classNames, discountPercent } from '../utils/helpers';
import type { Product, Review } from '../types';
export default function ProductDetails() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();
  const { user } = useAuth();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<(Review & { profile: { id: string; email: string; full_name: string | null } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [zoom, setZoom] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews'>('description');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);


  const refreshReviews = useCallback(async (productId: string) => {
  try {
    const data = await getReviews(productId);
    setReviews(data);
  } catch (error) {
    console.error('Failed to refresh reviews:', error);
  }
}, []);


  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setActiveImage(0);
    getProductBySlug(slug)
      .then((p) => {
        setProduct(p);
        if (p) {
          setSelectedSize(p.sizes[0] ?? '');
          setSelectedColor(p.colors[0] ?? '');
          if (p.category_id) {
            getRelatedProducts(p.category_id, p.id).then(setRelated);
          }
          getReviews(p.id).then(setReviews);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

useEffect(() => {
  if (!product?.id) return;

  const productId = product.id;

  const channel = supabase
    .channel(`product-${productId}-realtime`)

    // Listen for review changes
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reviews',
        filter: `product_id=eq.${productId}`,
      },
      async () => {
        console.log('Review changed - refreshing reviews');

        await refreshReviews(productId);
      },
    )

    // Listen for the product's rating/review_count changes
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'products',
        filter: `id=eq.${productId}`,
      },
      (payload) => {
        console.log('Product updated:', payload);

        setProduct((currentProduct) => {
          if (!currentProduct) {
            return currentProduct;
          }

          return {
            ...currentProduct,
            ...payload.new,
          };
        });
      },
    )

    .subscribe((status) => {
      console.log(
        `Product realtime status for ${productId}:`,
        status,
      );
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [product?.id, refreshReviews]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (product.stock === 0) {
      toast('Product is out of stock', 'error');
      return;
    }
    addItem(product, quantity, selectedSize, selectedColor);
    toast(`${product.name} added to cart`);
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (product.stock === 0) {
      toast('Product is out of stock', 'error');
      return;
    }
    addItem(product, quantity, selectedSize, selectedColor);
    navigate('/cart');
  };

  const handleWishlist = () => {
    if (!product) return;
    toggle(product);
    toast(has(product.id) ? 'Removed from wishlist' : 'Added to wishlist', 'info');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!user) {
    toast('Please sign in to leave a review', 'error');
    navigate('/login');
    return;
  }

  if (!product) return;

  if (!reviewComment.trim()) {
    toast('Please write a review comment', 'error');
    return;
  }

  setSubmittingReview(true);

  try {
    const newReview = await addReview(
      product.id,
      user.id,
      reviewRating,
      reviewTitle,
      reviewComment,
    );

    console.log('New review:', newReview);

    toast('Review submitted!');
    setReviewTitle('');
    setReviewComment('');
    setReviewRating(5);

    await refreshReviews(product.id);
  } catch (error) {
    console.error('Failed to submit review:', error);
    toast('Failed to submit review', 'error');
  } finally {
    setSubmittingReview(false);
  }
};

  if (loading) {
    return (
      <div className="section-padding py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          <ProductSkeleton />
          <div className="space-y-4">
            <div className="h-8 w-3/4 skeleton rounded" />
            <div className="h-6 w-1/4 skeleton rounded" />
            <div className="h-24 skeleton rounded" />
            <div className="h-12 skeleton rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="section-padding py-20 text-center">
        <h1 className="font-display text-3xl text-white mb-4">Product Not Found</h1>
        <Link to="/shop" className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider inline-block">
          Back to Shop
        </Link>
      </div>
    );
  }

  const discount = discountPercent(product.price, product.compare_at_price);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="section-padding py-4 border-b border-white/5">
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <Link to="/" className="hover:text-gold-400">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/shop" className="hover:text-gold-400">Shop</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white truncate">{product.name}</span>
        </div>
      </div>

      {/* Product main */}
      <div className="section-padding py-8 lg:py-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Gallery */}
          <div>
            <div
              className="relative aspect-square rounded-2xl overflow-hidden bg-ink-900 cursor-zoom-in"
              onMouseEnter={() => setZoom(true)}
              onMouseLeave={() => setZoom(false)}
              onMouseMove={handleMouseMove}
            >
              <img
                src={product.images[activeImage]}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300"
                style={zoom ? { transform: `scale(2.5)`, transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : undefined}
              />
              {discount > 0 && (
                <span className="absolute top-4 left-4 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-red-500 text-white rounded-full">
                  -{discount}%
                </span>
              )}
            </div>
            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-3 mt-4 overflow-x-auto hide-scrollbar">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={classNames(
                      'w-20 h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all',
                      activeImage === i ? 'border-gold-400' : 'border-transparent opacity-60 hover:opacity-100',
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {product.badge && (
                <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold-400 border border-gold-400/40 rounded-full mb-4">
                  {product.badge}
                </span>
              )}
              <h1 className="font-display text-3xl lg:text-4xl font-bold text-white mb-3">{product.name}</h1>

              {/* Rating */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={classNames(
                        'w-4 h-4',
                        i < Math.round(product.rating) ? 'fill-gold-400 text-gold-400' : 'text-ink-700',
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm text-ink-400">
                  {product.rating.toFixed(1)} ({product.review_count} reviews)
                </span>
              </div>

              {/* Price */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl font-bold text-white">{formatNaira(product.price)}</span>
                {product.compare_at_price && (
                  <span className="text-lg text-ink-500 line-through">{formatNaira(product.compare_at_price)}</span>
                )}
              </div>

              <p className="text-ink-300 text-sm leading-relaxed mb-8">{product.description}</p>

              {/* Colors */}
              {product.colors.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">
                    Color: <span className="text-white normal-case">{selectedColor}</span>
                  </h4>
                  <div className="flex gap-2">
                    {product.colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={classNames(
                          'px-4 py-2 text-sm rounded-lg border transition-all',
                          selectedColor === color
                            ? 'border-gold-400 bg-gold-400/10 text-gold-400'
                            : 'border-white/10 text-ink-300 hover:border-white/30',
                        )}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sizes */}
              {product.sizes.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-gold-400">Size</h4>
                    <button className="text-xs text-ink-400 hover:text-gold-400 underline">Size Guide</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={classNames(
                          'min-w-[3rem] px-4 py-2.5 text-sm rounded-lg border transition-all',
                          selectedSize === size
                            ? 'border-gold-400 bg-gold-400/10 text-gold-400'
                            : 'border-white/10 text-ink-300 hover:border-white/30',
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock */}
              <div className="mb-6">
                {product.stock > 0 ? (
                  product.stock <= 5 ? (
                    <p className="text-sm text-orange-400 font-medium">
                      Hurry! Only {product.stock} left in stock
                    </p>
                  ) : (
                    <p className="text-sm text-green-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400" /> In Stock
                    </p>
                  )
                ) : (
                  <p className="text-sm text-red-400 font-medium">Out of Stock</p>
                )}
              </div>

              {/* Quantity */}
              <div className="mb-8">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">Quantity</h4>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-white/10 rounded-lg">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-10 h-10 flex items-center justify-center text-ink-300 hover:text-gold-400 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center text-white font-medium">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                      className="w-10 h-10 flex items-center justify-center text-ink-300 hover:text-gold-400 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock === 0}
                  className="flex-1 btn-outline rounded-lg px-6 py-3.5 text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Add to Cart
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={product.stock === 0}
                  className="flex-1 btn-gold rounded-lg px-6 py-3.5 text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Zap className="w-4 h-4" />
                  Buy Now
                </button>
                <button
                  onClick={handleWishlist}
                  className="w-12 h-12 rounded-lg border border-white/10 flex items-center justify-center text-ink-300 hover:text-gold-400 hover:border-gold-400/40 transition-all shrink-0"
                >
                  <Heart className={classNames('w-5 h-5', has(product.id) && 'fill-gold-400 text-gold-400')} />
                </button>
              </div>

              {/* Trust */}
              <div className="grid grid-cols-3 gap-3 pt-6 border-t border-white/10">
                {[
                  { icon: Truck, label: 'Free Shipping', sub: 'Over ₦100k' },
                  { icon: Shield, label: 'Secure', sub: 'Paystack' },
                  { icon: RefreshCw, label: '7-Day', sub: 'Returns' },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center text-center gap-1">
                    <item.icon className="w-5 h-5 text-gold-400" />
                    <span className="text-xs text-white font-medium">{item.label}</span>
                    <span className="text-[10px] text-ink-500">{item.sub}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-16 lg:mt-20">
          <div className="flex gap-6 border-b border-white/10 mb-8">
            {(['description', 'specs', 'reviews'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={classNames(
                  'pb-3 text-sm font-medium uppercase tracking-wider transition-colors relative',
                  activeTab === tab ? 'text-gold-400' : 'text-ink-400 hover:text-white',
                )}
              >
                {tab === 'description' && 'Description'}
                {tab === 'specs' && 'Specifications'}
                {tab === 'reviews' && `Reviews (${reviews.length})`}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-400" />
                )}
              </button>
            ))}
          </div>

          <div className="max-w-3xl">
            {activeTab === 'description' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-ink-300 leading-relaxed">{product.description}</p>
                <ul className="mt-6 space-y-2 text-sm text-ink-300">
                  <li className="flex items-center gap-2"><ChevronRight className="w-4 h-4 text-gold-400" /> Premium quality materials</li>
                  <li className="flex items-center gap-2"><ChevronRight className="w-4 h-4 text-gold-400" /> Ethically sourced and produced</li>
                  <li className="flex items-center gap-2"><ChevronRight className="w-4 h-4 text-gold-400" /> Designed in Lagos, Nigeria</li>
                  <li className="flex items-center gap-2"><ChevronRight className="w-4 h-4 text-gold-400" /> Limited production runs</li>
                </ul>
              </motion.div>
            )}

            {activeTab === 'specs' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {[
                  { label: 'Material', value: 'Premium cotton blend' },
                  { label: 'Fit', value: 'Regular fit' },
                  { label: 'Care', value: 'Machine wash cold, hang dry' },
                  { label: 'Origin', value: 'Designed in Lagos, Nigeria' },
                  { label: 'SKU', value: product.slug.toUpperCase() },
                ].map((spec) => (
                  <div key={spec.label} className="flex justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-ink-400">{spec.label}</span>
                    <span className="text-sm text-white font-medium">{spec.value}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'reviews' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Write review */}
                <form onSubmit={handleSubmitReview} className="glass rounded-2xl p-6 mb-8">
                  <h4 className="font-display text-lg font-bold text-white mb-4">Write a Review</h4>
                  <div className="mb-4">
                    <div className="flex gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setReviewRating(i + 1)}
                        >
                          <Star className={classNames('w-6 h-6 transition-colors', i < reviewRating ? 'fill-gold-400 text-gold-400' : 'text-ink-700 hover:text-ink-500')} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="Review title"
                    className="input-field mb-3"
                  />
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your thoughts..."
                    rows={3}
                    className="input-field mb-3 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="btn-gold rounded-lg px-6 py-2.5 text-sm uppercase tracking-wider disabled:opacity-50"
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>

                {/* Reviews list */}
                <div className="space-y-4">
                  {reviews.length === 0 ? (
                    <p className="text-ink-400 text-sm">No reviews yet. Be the first to review!</p>
                  ) : (
                    reviews.map((review) => (
                      <div key={review.id} className="glass rounded-xl p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-white">
                            {review.profile?.full_name || review.profile?.email?.split('@')[0] || 'Anonymous'}
                          </span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={classNames('w-3.5 h-3.5', i < review.rating ? 'fill-gold-400 text-gold-400' : 'text-ink-700')} />
                            ))}
                          </div>
                        </div>
                        {review.title && <h5 className="text-sm font-medium text-white mb-1">{review.title}</h5>}
                        <p className="text-sm text-ink-300">{review.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-16 lg:mt-20">
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-white mb-8">You May Also Like</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
