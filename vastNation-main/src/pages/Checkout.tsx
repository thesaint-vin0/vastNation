import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  CreditCard,
  Truck,
  MapPin,
  User,
  Lock,
  ChevronRight,
} from 'lucide-react';

import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

import { createOrder } from '../services/api';

import {
  formatNaira,
  generateOrderNumber,
  generateReference,
  classNames,
} from '../utils/helpers';

import type { Coupon } from '../types';

import { initializePaystackPayment } from '../services/paystack';

type CheckoutState = {
  coupon: Coupon | null;
  deliveryMethod: string;
  discount: number;
  shipping: number;
  total: number;
};

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();

  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();

  const state = (location.state as CheckoutState) ?? {
    coupon: null,
    deliveryMethod: 'standard',
    discount: 0,
    shipping: calculateShippingSafe(subtotal),
    total: subtotal,
  };

  const [step, setStep] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  const [customerInfo, setCustomerInfo] = useState({
    fullName: user?.email ?? '',
    email: user?.email ?? '',
    phone: '',
  });

  const [shippingAddress, setShippingAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Nigeria',
  });

  function calculateShippingSafe(sub: number): number {
    return sub >= 100 ? 0 : 2500;
  }

  /*
   * ============================================================
   * PAY FOR ORDER
   * ============================================================
   *
   * Flow:
   *
   * 1. Check authentication
   * 2. Validate customer information
   * 3. Create order as "pending"
   * 4. Call Supabase paystack-initialize function
   * 5. Receive Paystack authorization_url
   * 6. Redirect customer to Paystack
   *
   * The order is NOT marked as paid here.
   *
   * Paystack webhook will later confirm the payment and
   * update payment_status to "paid".
   */
  const handlePay = async () => {
    if (!user) {
      toast('Please sign in to complete your order', 'error');
      navigate('/login');
      return;
    }

    if (!customerInfo.fullName.trim()) {
      toast('Please enter your full name', 'error');
      setStep(1);
      return;
    }

    if (!customerInfo.email.trim()) {
      toast('Please enter your email address', 'error');
      setStep(1);
      return;
    }

    if (!customerInfo.phone.trim()) {
      toast('Please enter your phone number', 'error');
      setStep(1);
      return;
    }

    if (!shippingAddress.line1.trim()) {
      toast('Please enter your delivery address', 'error');
      setStep(2);
      return;
    }

    if (!shippingAddress.city.trim()) {
      toast('Please enter your city', 'error');
      setStep(2);
      return;
    }

    if (!shippingAddress.state.trim()) {
      toast('Please enter your state', 'error');
      setStep(2);
      return;
    }

    if (items.length === 0) {
      toast('Your cart is empty', 'error');
      navigate('/shop');
      return;
    }

    setProcessing(true);

    const orderNumberValue = generateOrderNumber();
    const localReference = generateReference();

    try {
      /*
       * ========================================================
       * STEP 1 — CREATE PENDING ORDER
       * ========================================================
       */

      const order = await createOrder(
        {
          user_id: user.id,

          order_number: orderNumberValue,

          status: 'pending',

          subtotal,

          discount: state.discount,

          shipping: state.shipping,

          total: state.total,

          coupon_code: state.coupon?.code ?? null,

          shipping_address: {
            ...shippingAddress,
            ...customerInfo,
          } as unknown as Record<string, unknown>,

          delivery_method: state.deliveryMethod,

          /*
           * This is initially a local/reference value.
           *
           * Your Paystack Edge Function should ultimately use
           * the Paystack reference as the source of truth.
           */
          payment_ref: localReference,

          /*
           * Payment has NOT happened yet.
           */
          payment_status: 'pending',
        },

        /*
         * Order items
         */
        items.map((item) => ({
          product_id: item.product.id,
          name: item.product.name,
          image_url: item.product.images[0] ?? null,
          size: item.size,
          color: item.color,
          price: item.product.price,
          quantity: item.quantity,
        })),
      );

      /*
       * Make sure Supabase actually returned an order ID.
       */
      if (!order?.id) {
        throw new Error(
          'Order was created but no order ID was returned.',
        );
      }

      /*
       * ========================================================
       * STEP 2 — INITIALIZE PAYSTACK
       * ========================================================
       *
       * This calls:
       *
       * supabase/functions/paystack-initialize
       *
       * The Edge Function communicates with Paystack using
       * the secret key.
       */

      const payment = await initializePaystackPayment(
        customerInfo.email.trim(),
        state.total,
        order.id,
      );

      /*
       * Make sure Paystack returned a checkout URL.
       */
      if (!payment?.authorization_url) {
        throw new Error(
          'Paystack did not return an authorization URL.',
        );
      }

      /*
       * Store information locally for the UI.
       *
       * We are NOT marking the payment as successful.
       */
      setOrderNumber(orderNumberValue);

      setPaymentRef(
        payment.reference ?? localReference,
      );

      /*
       * ========================================================
       * STEP 3 — REDIRECT TO PAYSTACK
       * ========================================================
       */

      window.location.href =
        payment.authorization_url;

      /*
       * IMPORTANT:
       *
       * We intentionally DO NOT:
       *
       * clearCart()
       *
       * setCompleted(true)
       *
       * recordPayment()
       *
       * updateOrderPayment(..., 'paid')
       *
       * because the customer has not completed payment yet.
       *
       * The Paystack webhook will handle successful payment.
       */
    } catch (error) {
      console.error(
        'Paystack payment initialization failed:',
        error,
      );

      toast(
        'Unable to start payment. Please try again.',
        'error',
      );

      setProcessing(false);
    }
  };

  /*
   * ============================================================
   * EMPTY CART
   * ============================================================
   */

  if (items.length === 0 && !completed) {
    return (
      <div className="section-padding py-20 text-center">
        <h1 className="font-display text-3xl text-white mb-4">
          Your Cart is Empty
        </h1>

        <Link
          to="/shop"
          className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider inline-block"
        >
          Go to Shop
        </Link>
      </div>
    );
  }

  /*
   * ============================================================
   * PAYMENT SUCCESS SCREEN
   * ============================================================
   *
   * This screen is kept for the existing checkout structure.
   *
   * IMPORTANT:
   *
   * The new Paystack flow does not automatically reach this
   * screen after redirecting to Paystack.
   *
   * We will later create a dedicated payment-return page.
   */

  if (completed) {
    return (
      <div className="section-padding py-20">
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.9,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          className="max-w-lg mx-auto text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              delay: 0.2,
              type: 'spring',
            }}
            className="w-24 h-24 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-12 h-12 text-green-400" />
          </motion.div>

          <h1 className="font-display text-4xl font-bold text-white mb-3">
            Order Confirmed!
          </h1>

          <p className="text-ink-300 mb-8">
            Thank you for your purchase. We've sent a
            confirmation email with your order details.
          </p>

          <div className="glass rounded-2xl p-6 text-left mb-8">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-ink-400">
                  Order Number
                </span>

                <span className="text-sm text-white font-mono font-medium">
                  {orderNumber}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-ink-400">
                  Payment Reference
                </span>

                <span className="text-sm text-white font-mono font-medium">
                  {paymentRef}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-ink-400">
                  Total Paid
                </span>

                <span className="text-sm text-gold-400 font-bold">
                  {formatNaira(state.total)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-ink-400">
                  Status
                </span>

                <span className="text-sm text-green-400 font-medium">
                  Paid
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/dashboard"
              className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider"
            >
              View Orders
            </Link>

            <Link
              to="/shop"
              className="btn-outline rounded-lg px-6 py-3 text-sm uppercase tracking-wider"
            >
              Continue Shopping
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  /*
   * ============================================================
   * CHECKOUT STEPS
   * ============================================================
   */

  const steps = [
    {
      num: 1,
      label: 'Information',
      icon: User,
    },
    {
      num: 2,
      label: 'Shipping',
      icon: MapPin,
    },
    {
      num: 3,
      label: 'Payment',
      icon: CreditCard,
    },
  ];

  /*
   * ============================================================
   * MAIN CHECKOUT UI
   * ============================================================
   */

  return (
    <div className="section-padding py-8 lg:py-12">
      <h1 className="font-display text-3xl lg:text-4xl font-bold text-white mb-8">
        Checkout
      </h1>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8 max-w-2xl">
        {steps.map((s, i) => (
          <div
            key={s.num}
            className="flex items-center gap-2 flex-1"
          >
            <div
              className={classNames(
                'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                step >= s.num
                  ? 'bg-gold-400 text-ink-950'
                  : 'glass text-ink-400',
              )}
            >
              <s.icon className="w-5 h-5" />
            </div>

            <span
              className={classNames(
                'text-sm font-medium hidden sm:block',
                step >= s.num
                  ? 'text-white'
                  : 'text-ink-500',
              )}
            >
              {s.label}
            </span>

            {i < steps.length - 1 && (
              <div
                className={classNames(
                  'h-px flex-1 transition-all',
                  step > s.num
                    ? 'bg-gold-400'
                    : 'bg-white/10',
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* =====================================================
            FORM
        ====================================================== */}

        <div className="lg:col-span-2">
          {/* ===================================================
              STEP 1 — INFORMATION
          ==================================================== */}

          {step === 1 && (
            <motion.div
              initial={{
                opacity: 0,
                x: 20,
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="font-display text-xl font-bold text-white mb-6">
                Customer Information
              </h2>

              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                    Full Name
                  </label>

                  <input
                    type="text"
                    value={customerInfo.fullName}
                    onChange={(e) =>
                      setCustomerInfo({
                        ...customerInfo,
                        fullName: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="Enter your full name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                    Email
                  </label>

                  <input
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) =>
                      setCustomerInfo({
                        ...customerInfo,
                        email: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="your@email.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                    Phone
                  </label>

                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) =>
                      setCustomerInfo({
                        ...customerInfo,
                        phone: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="+234..."
                  />
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={
                  !customerInfo.fullName ||
                  !customerInfo.email ||
                  !customerInfo.phone
                }
                className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider mt-6 disabled:opacity-40"
              >
                Continue to Shipping

                <ChevronRight className="w-4 h-4 inline" />
              </button>
            </motion.div>
          )}

          {/* ===================================================
              STEP 2 — SHIPPING
          ==================================================== */}

          {step === 2 && (
            <motion.div
              initial={{
                opacity: 0,
                x: 20,
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="font-display text-xl font-bold text-white mb-6">
                Shipping Address
              </h2>

              <div className="space-y-4">
                {/* Address Line 1 */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                    Address Line 1
                  </label>

                  <input
                    type="text"
                    value={shippingAddress.line1}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        line1: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="House number, street name"
                  />
                </div>

                {/* Address Line 2 */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                    Address Line 2 (Optional)
                  </label>

                  <input
                    type="text"
                    value={shippingAddress.line2}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        line2: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="Apartment, suite, etc."
                  />
                </div>

                {/* City + State */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                      City
                    </label>

                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          city: e.target.value,
                        })
                      }
                      className="input-field"
                      placeholder="Lagos"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                      State
                    </label>

                    <input
                      type="text"
                      value={shippingAddress.state}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          state: e.target.value,
                        })
                      }
                      className="input-field"
                      placeholder="Lagos State"
                    />
                  </div>
                </div>

                {/* Postal Code + Country */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                      Postal Code
                    </label>

                    <input
                      type="text"
                      value={shippingAddress.postalCode}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          postalCode: e.target.value,
                        })
                      }
                      className="input-field"
                      placeholder="100001"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2 block">
                      Country
                    </label>

                    <input
                      type="text"
                      value={shippingAddress.country}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          country: e.target.value,
                        })
                      }
                      className="input-field"
                      disabled
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="btn-outline rounded-lg px-6 py-3 text-sm uppercase tracking-wider"
                >
                  Back
                </button>

                <button
                  onClick={() => setStep(3)}
                  disabled={
                    !shippingAddress.line1 ||
                    !shippingAddress.city ||
                    !shippingAddress.state
                  }
                  className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider disabled:opacity-40"
                >
                  Continue to Payment

                  <ChevronRight className="w-4 h-4 inline" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ===================================================
              STEP 3 — PAYMENT
          ==================================================== */}

          {step === 3 && (
            <motion.div
              initial={{
                opacity: 0,
                x: 20,
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="font-display text-xl font-bold text-white mb-6">
                Payment Method
              </h2>

              {/* Paystack */}
              <div className="border border-gold-400/40 rounded-xl p-4 mb-6 bg-gold-400/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gold-400/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-gold-400" />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Paystack
                    </h3>

                    <p className="text-xs text-ink-400">
                      Pay with card, bank transfer, or USSD
                    </p>
                  </div>

                  <CheckCircle className="w-5 h-5 text-gold-400 ml-auto" />
                </div>
              </div>

              {/* Security message */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-ink-900/50 mb-6">
                <Lock className="w-4 h-4 text-gold-400 mt-0.5 shrink-0" />

                <p className="text-xs text-ink-400">
                  Your payment is secured by Paystack.
                  We never store your card details.
                  Payment is verified server-side before
                  your order is confirmed.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  disabled={processing}
                  className="btn-outline rounded-lg px-6 py-3 text-sm uppercase tracking-wider disabled:opacity-50"
                >
                  Back
                </button>

                <button
                  onClick={handlePay}
                  disabled={processing}
                  className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <motion.div
                        animate={{
                          rotate: 360,
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                        className="w-4 h-4 border-2 border-ink-950 border-t-transparent rounded-full"
                      />

                      Redirecting to Paystack...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />

                      Pay {formatNaira(state.total)}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* =====================================================
            ORDER SUMMARY
        ====================================================== */}

        <div className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 sticky top-28">
            <h2 className="font-display text-xl font-bold text-white mb-6">
              Your Order
            </h2>

            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={`${item.product.id}-${item.size}-${item.color}`}
                  className="flex gap-3"
                >
                  <div className="relative shrink-0">
                    <img
                      src={item.product.images[0]}
                      alt=""
                      className="w-14 h-16 object-cover rounded-lg"
                    />

                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-gold-400 text-ink-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.quantity}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-medium text-white truncate">
                      {item.product.name}
                    </h4>

                    <p className="text-xs text-ink-500">
                      {item.size} / {item.color}
                    </p>

                    <p className="text-xs text-gold-400 font-medium mt-1">
                      {formatNaira(
                        item.product.price *
                          item.quantity,
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className="space-y-2 py-4 border-t border-white/10">
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">
                  Subtotal
                </span>

                <span className="text-white">
                  {formatNaira(subtotal)}
                </span>
              </div>

              {state.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">
                    Discount
                  </span>

                  <span className="text-green-400">
                    -{formatNaira(state.discount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-ink-400 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" />

                  Shipping
                </span>

                <span className="text-white">
                  {state.shipping === 0
                    ? 'FREE'
                    : formatNaira(state.shipping)}
                </span>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-4 border-t border-white/10">
              <span className="font-bold text-white">
                Total
              </span>

              <span className="text-2xl font-bold text-gold-400">
                {formatNaira(state.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}