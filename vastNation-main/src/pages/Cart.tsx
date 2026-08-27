import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, X, ShoppingBag, Tag, ArrowRight, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getCheckoutSettings, validateCoupon } from '../services/api';
import { formatNaira, calculateDiscount, calculateShipping, classNames, type ShippingSettings } from '../utils/helpers';
import type { Coupon } from '../types';

export default function Cart() {
  const { items, removeItem, updateQuantity, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState('standard');
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings>({
    shipping_threshold: 100000,
    default_shipping_fee: 2500,
    express_shipping_fee: 5000,
  });

  useEffect(() => {
    let mounted = true;
    void getCheckoutSettings()
      .then((settings) => {
        if (mounted) setShippingSettings(settings);
      })
      .catch((error) => {
        console.error('Failed to load checkout settings:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const discount = calculateDiscount(subtotal, coupon);
  const shipping = calculateShipping(subtotal - discount, deliveryMethod, shippingSettings);
  const total = subtotal - discount + shipping;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const result = await validateCoupon(couponCode, user?.id);
      if (!result) {
        toast('Invalid or expired coupon code', 'error');
        setCoupon(null);
      } else if (subtotal < result.min_order) {
        toast(`Minimum order of ${formatNaira(result.min_order)} required`, 'error');
        setCoupon(null);
      } else {
        setCoupon(result);
        toast('Coupon applied!');
      }
    } catch {
      toast('Failed to validate coupon', 'error');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleCheckout = () => {
    if (items.length === 0) return;
    navigate('/checkout', { state: { coupon, deliveryMethod, discount, shipping, total } });
  };

  if (items.length === 0) {
    return (
      <div className="section-padding py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <div className="w-24 h-24 rounded-full glass flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-10 h-10 text-ink-500" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white mb-3">Your Cart is Empty</h1>
          <p className="text-ink-400 mb-8">Looks like you haven't added anything yet. Let's fix that.</p>
          <Link to="/shop" className="btn-gold rounded-full px-8 py-3.5 text-sm uppercase tracking-widest inline-flex items-center gap-2 group">
            Start Shopping <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="section-padding py-8 lg:py-12">
      <h1 className="font-display text-3xl lg:text-4xl font-bold text-white mb-8">Shopping Cart</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={`${item.product.id}-${item.size}-${item.color}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="glass rounded-2xl p-4 flex gap-4"
              >
                <Link to={`/product/${item.product.slug}`} className="shrink-0">
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    className="w-24 h-32 object-cover rounded-xl"
                  />
                </Link>

                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/product/${item.product.slug}`}>
                        <h3 className="text-sm font-semibold text-white truncate hover:text-gold-400 transition-colors">
                          {item.product.name}
                        </h3>
                      </Link>
                      <div className="flex gap-3 mt-1 text-xs text-ink-400">
                        <span>Size: {item.size}</span>
                        <span>Color: {item.color}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id, item.size, item.color)}
                      className="text-ink-500 hover:text-red-400 transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-end justify-between mt-auto">
                    <div className="flex items-center border border-white/10 rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.size, item.color, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center text-ink-300 hover:text-gold-400 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm text-white font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.size, item.color, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center text-ink-300 hover:text-gold-400 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-white">
                      {formatNaira(item.product.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="flex justify-between items-center pt-4">
            <Link to="/shop" className="text-sm text-ink-300 hover:text-gold-400 transition-colors flex items-center gap-2">
              <ArrowRight className="w-4 h-4 rotate-180" /> Continue Shopping
            </Link>
            <button
              onClick={clearCart}
              className="text-sm text-ink-400 hover:text-red-400 transition-colors"
            >
              Clear Cart
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 sticky top-28">
            <h2 className="font-display text-xl font-bold text-white mb-6">Order Summary</h2>

            {/* Coupon */}
            <form onSubmit={handleApplyCoupon} className="mb-6">
              <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">Coupon Code</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter code"
                    className="input-field pl-10"
                  />
                </div>
                <button
                  type="submit"
                  disabled={couponLoading}
                  className="btn-outline rounded-lg px-4 text-sm uppercase tracking-wider disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
              {coupon && (
                <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> {coupon.code} applied — {coupon.type === 'percent' ? `${coupon.value}% off` : `${formatNaira(coupon.value)} off`}
                </p>
              )}
              <p className="text-xs text-ink-500 mt-2">Try: WELCOME10, VAST20, FREESHIP</p>
            </form>

            {/* Delivery */}
            <div className="mb-6">
              <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">Delivery Method</label>
              <div className="space-y-2">
                {[
                  { value: 'standard', label: 'Standard (3-5 days)', price: subtotal >= 100 ? 0 : 2500 },
                  { value: 'express', label: 'Express (1-2 days)', price: 5000 },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDeliveryMethod(opt.value)}
                    className={classNames(
                      'w-full flex items-center justify-between p-3 rounded-lg border text-sm transition-all',
                      deliveryMethod === opt.value
                        ? 'border-gold-400 bg-gold-400/10 text-white'
                        : 'border-white/10 text-ink-300 hover:border-white/30',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-gold-400" />
                      {opt.label}
                    </span>
                    <span className="font-medium">{opt.price === 0 ? 'FREE' : formatNaira(opt.price)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-3 py-4 border-t border-white/10">
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">Subtotal</span>
                <span className="text-white font-medium">{formatNaira(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">Discount</span>
                  <span className="text-green-400 font-medium">-{formatNaira(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">Shipping</span>
                <span className="text-white font-medium">{shipping === 0 ? 'FREE' : formatNaira(shipping)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-4 border-t border-white/10">
              <span className="text-lg font-bold text-white">Total</span>
              <span className="text-2xl font-bold text-gold-400">{formatNaira(total)}</span>
            </div>

            <button
              onClick={handleCheckout}
              className="btn-gold rounded-lg w-full py-4 text-sm uppercase tracking-widest flex items-center justify-center gap-2 group mt-2"
            >
              Proceed to Checkout <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
