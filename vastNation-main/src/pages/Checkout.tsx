import { useEffect, useState } from 'react';
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

import { createOrder, getStoreSettings } from '../services/api';
import { initializePaystackPayment } from '../services/paystack';

import {
  formatNaira,
  generateOrderNumber,
  classNames,
} from '../utils/helpers';

import { supabase } from '../lib/supabase';

import type { Coupon } from '../types';

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

  /*
   * ============================================================
   * CONTEXT
   * ============================================================
   */

  const { items, subtotal } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();

  /*
   * ============================================================
   * CHECKOUT STATE
   * ============================================================
   */

  const [step, setStep] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [storeSettings, setStoreSettings] = useState<Awaited<ReturnType<typeof getStoreSettings>> | null>(null);

  /*
   * ============================================================
   * CUSTOMER INFORMATION
   * ============================================================
   */

  const [customerInfo, setCustomerInfo] = useState({
    fullName: user?.email ?? '',
    email: user?.email ?? '',
    phone: '',
  });

  /*
   * ============================================================
   * SHIPPING ADDRESS
   * ============================================================
   */

  const [shippingAddress, setShippingAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Nigeria',
  });

  /*
   * ============================================================
   * CART / CHECKOUT STATE
   * ============================================================
   */

  const incomingState = location.state as CheckoutState | null;

  const discount = incomingState?.discount ?? 0;

  const deliveryMethod =
    incomingState?.deliveryMethod ?? 'standard';

  /*
   * ============================================================
   * SHIPPING CALCULATION
   * ============================================================
   *
   * ₦100,000 or more = FREE SHIPPING
   *
   * Below ₦100,000 = ₦2,500
   */

  useEffect(() => {
    void getStoreSettings().then(setStoreSettings).catch((error) => console.error('Failed to load store settings:', error));
  }, []);

  const calculateShippingSafe = (sub: number): number => {
    const threshold = storeSettings?.free_shipping_threshold ?? 100000;
    if (deliveryMethod === 'express') return storeSettings?.express_shipping_fee ?? 5000;
    return sub >= threshold ? 0 : (storeSettings?.standard_shipping_fee ?? 2500);
  };

  const shipping = calculateShippingSafe(subtotal);
  const tax = Math.max(0, (subtotal - discount) * ((storeSettings?.tax_rate ?? 0) / 100));
  const total = Math.max(0, subtotal - discount + shipping + tax);

  /*
   * ============================================================
   * PAY FOR ORDER
   * ============================================================
   *
   * Payment flow:
   *
   * 1. Validate customer
   * 2. Validate shipping
   * 3. Create pending order
   * 4. Call Supabase Edge Function
   * 5. Edge Function initializes Paystack
   * 6. Receive REAL Paystack reference
   * 7. Save REAL reference to order
   * 8. Redirect customer to Paystack
   *
   * The browser NEVER marks the order as paid.
   *
   * The webhook is responsible for:
   *
   * payment_status = paid
   * payment_reference
   * payment_ref
   * paid_at
   * payment_method
   * paystack_transaction_id
   */

  const handlePay = async () => {
    if (processing) {
      return;
    }

    /*
     * ==========================================================
     * AUTHENTICATION
     * ==========================================================
     */

    if (!user) {
      toast(
        'Please sign in to complete your order',
        'error',
      );

      navigate('/login');
      return;
    }

    /*
     * ==========================================================
     * CUSTOMER VALIDATION
     * ==========================================================
     */

    if (!customerInfo.fullName.trim()) {
      toast(
        'Please enter your full name',
        'error',
      );

      setStep(1);
      return;
    }

    if (!customerInfo.email.trim()) {
      toast(
        'Please enter your email address',
        'error',
      );

      setStep(1);
      return;
    }

    if (!customerInfo.phone.trim()) {
      toast(
        'Please enter your phone number',
        'error',
      );

      setStep(1);
      return;
    }

    /*
     * ==========================================================
     * SHIPPING VALIDATION
     * ==========================================================
     */

    if (!shippingAddress.line1.trim()) {
      toast(
        'Please enter your delivery address',
        'error',
      );

      setStep(2);
      return;
    }

    if (!shippingAddress.city.trim()) {
      toast(
        'Please enter your city',
        'error',
      );

      setStep(2);
      return;
    }

    if (!shippingAddress.state.trim()) {
      toast(
        'Please enter your state',
        'error',
      );

      setStep(2);
      return;
    }

    /*
     * ==========================================================
     * CART VALIDATION
     * ==========================================================
     */

    if (items.length === 0) {
      toast(
        'Your cart is empty',
        'error',
      );

      navigate('/shop');
      return;
    }

    setProcessing(true);

    try {
      /*
       * ========================================================
       * STEP 1 — CREATE PENDING ORDER
       * ========================================================
       */

      const orderNumber = generateOrderNumber();

      const order = await createOrder(
        {
          user_id: user.id,

          order_number: orderNumber,

          /*
           * Customer order status.
           *
           * Payment status is separate.
           */
          status: 'pending',

          subtotal,

          discount,

          shipping,

          total,

          coupon_code:
            incomingState?.coupon?.code ?? null,

          shipping_address: {
            ...shippingAddress,
            ...customerInfo,
          } as unknown as Record<string, unknown>,

          delivery_method: deliveryMethod,

          /*
           * IMPORTANT:
           *
           * Do NOT generate a fake/local Paystack reference.
           *
           * The Edge Function generates the real
           * Paystack reference.
           */
          payment_ref: null,

          /*
           * Payment has not happened yet.
           */
          payment_status: 'pending',
        },

        /*
         * ORDER ITEMS
         */

        items.map((item) => ({
          product_id: item.product.id,

          name: item.product.name,

          image_url:
            item.product.images[0] ?? null,

          size: item.size,

          color: item.color,

          price: item.product.price,

          quantity: item.quantity,
        })),
      );

      /*
       * Make sure order creation succeeded.
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
       */

      const payment =
        await initializePaystackPayment(
          customerInfo.email.trim(),
          total,
          order.id,
        );

      /*
       * ========================================================
       * VALIDATE PAYSTACK RESPONSE
       * ========================================================
       */

      if (!payment?.authorization_url) {
        throw new Error(
          'Paystack did not return an authorization URL.',
        );
      }

      if (!payment?.reference) {
        throw new Error(
          'Paystack did not return a payment reference.',
        );
      }

      /*
       * ========================================================
       * STEP 3 — SAVE REAL PAYSTACK REFERENCE
       * ========================================================
       *
       * This is extremely important.
       *
       * Paystack generates a reference such as:
       *
       * VN-ORDER-ID-RANDOM-ID
       *
       * The webhook receives this exact reference.
       *
       * We therefore store it in both:
       *
       * payment_ref
       * payment_reference
       */

      const {
        error: referenceUpdateError,
      } = await supabase
        .from('orders')
        .update({
          payment_ref: payment.reference,
          payment_reference: payment.reference,
        })
        .eq('id', order.id);

      if (referenceUpdateError) {
        console.error(
          'Failed to save Paystack reference:',
          referenceUpdateError,
        );

        throw new Error(
          'Unable to link your payment to the order. Please try again.',
        );
      }

      /*
       * ========================================================
       * STEP 4 — REDIRECT TO PAYSTACK
       * ========================================================
       *
       * DO NOT:
       *
       * - mark payment as paid
       * - change payment_status
       * - clear cart
       * - create payment history
       *
       * The webhook does that after Paystack confirms
       * the transaction.
       */

      window.location.href =
        payment.authorization_url;
    } catch (error) {
      console.error(
        'Paystack payment initialization failed:',
        error,
      );

      toast(
        error instanceof Error
          ? error.message
          : 'Unable to start payment. Please try again.',
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

  if (items.length === 0) {
    return (
      <div className="section-padding py-20 text-center">
        <h1 className="font-display text-3xl text-white mb-4">
          Your Cart is Empty
        </h1>

        <p className="text-ink-400 mb-6">
          Add some products to your cart before
          checking out.
        </p>

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
   * MAIN CHECKOUT
   * ============================================================
   */

  return (
    <div className="section-padding py-8 lg:py-12">
      <h1 className="font-display text-3xl lg:text-4xl font-bold text-white mb-8">
        Checkout
      </h1>

      {/* ======================================================
          CHECKOUT STEPS
      ======================================================= */}

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
            CHECKOUT FORM
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

                {/* FULL NAME */}

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

                {/* EMAIL */}

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

                {/* PHONE */}

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
                  !customerInfo.fullName.trim() ||
                  !customerInfo.email.trim() ||
                  !customerInfo.phone.trim()
                }
                className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider mt-6 disabled:opacity-40"
              >
                Continue to Shipping

                <ChevronRight className="w-4 h-4 inline ml-1" />
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

                {/* ADDRESS LINE 1 */}

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

                {/* ADDRESS LINE 2 */}

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

                {/* CITY / STATE */}

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

                {/* POSTAL / COUNTRY */}

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
                      className="input-field"
                      disabled
                      readOnly
                    />
                  </div>

                </div>
              </div>

              {/* NAVIGATION */}

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
                    !shippingAddress.line1.trim() ||
                    !shippingAddress.city.trim() ||
                    !shippingAddress.state.trim()
                  }
                  className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider disabled:opacity-40"
                >
                  Continue to Payment

                  <ChevronRight className="w-4 h-4 inline ml-1" />
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

              {/* PAYSTACK */}

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

              {/* SECURITY */}

              <div className="flex items-start gap-3 p-4 rounded-xl bg-ink-900/50 mb-6">

                <Lock className="w-4 h-4 text-gold-400 mt-0.5 shrink-0" />

                <p className="text-xs text-ink-400">
                  Your payment is secured by Paystack.
                  We never store your card details.
                  Payment is verified server-side before
                  your order is confirmed.
                </p>

              </div>

              {/* PAYMENT SUMMARY */}

              <div className="rounded-xl border border-white/10 p-4 mb-6">

                <div className="flex justify-between text-sm mb-2">

                  <span className="text-ink-400">
                    Amount to pay
                  </span>

                  <span className="text-white font-bold">
                    {formatNaira(total)}
                  </span>

                </div>

                <div className="flex justify-between text-xs">

                  <span className="text-ink-500">
                    Payment status
                  </span>

                  <span className="text-yellow-400">
                    Pending until Paystack confirms
                  </span>

                </div>

              </div>

              {/* BUTTONS */}

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

                      Pay {formatNaira(total)}
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

            {/* PRODUCTS */}

            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">

              {items.map((item) => (
                <div
                  key={`${item.product.id}-${item.size}-${item.color}`}
                  className="flex gap-3"
                >

                  <div className="relative shrink-0">

                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
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

            {/* PRICE BREAKDOWN */}

            <div className="space-y-2 py-4 border-t border-white/10">

              <div className="flex justify-between text-sm">

                <span className="text-ink-400">
                  Subtotal
                </span>

                <span className="text-white">
                  {formatNaira(subtotal)}
                </span>

              </div>

              {discount > 0 && (
                <div className="flex justify-between text-sm">

                  <span className="text-green-400">
                    Discount
                  </span>

                  <span className="text-green-400">
                    -{formatNaira(discount)}
                  </span>

                </div>
              )}

              <div className="flex justify-between text-sm">

                <span className="text-ink-400 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" />
                  Shipping
                </span>

                <span className="text-white">
                  {shipping === 0
                    ? 'FREE'
                    : formatNaira(shipping)}
                </span>

              </div>

              {subtotal >= 100000 && (
                <p className="text-xs text-green-400 mt-2">
                  Free shipping applied on orders of ₦100,000+
                </p>
              )}

            </div>

            {/* TOTAL */}

            <div className="flex justify-between items-center pt-4 border-t border-white/10">

              <span className="font-bold text-white">
                Total
              </span>

              <span className="text-2xl font-bold text-gold-400">
                {formatNaira(total)}
              </span>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}