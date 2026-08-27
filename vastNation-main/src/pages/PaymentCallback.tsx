import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatNaira } from '../utils/helpers';

type PaymentState = 'checking' | 'success' | 'failed' | 'pending';

type OrderResult = {
  id: string;
  order_number: string;
  total: number;
  payment_status: string | null;
  status: string | null;
  payment_reference: string | null;
};

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { clearCart } = useCart();

  const reference =
    searchParams.get('reference') ||
    searchParams.get('trxref');

  const [state, setState] = useState<PaymentState>('checking');
  const [order, setOrder] = useState<OrderResult | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!reference || !user) {
      setState('failed');
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let attempts = 0;

    const checkPayment = async () => {
      attempts += 1;

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total, payment_status, status, payment_reference')
        .eq('user_id', user.id)
        .or(`payment_reference.eq.${reference},payment_ref.eq.${reference}`)
        .maybeSingle();

      if (cancelled) return;

      if (!error && data) {
        const found = data as OrderResult;
        setOrder(found);

        if (found.payment_status === 'paid') {
          clearCart();
          setState('success');
          if (interval) clearInterval(interval);
          return;
        }

        if (found.payment_status === 'failed') {
          setState('failed');
          if (interval) clearInterval(interval);
          return;
        }
      }

      if (attempts >= 15) {
        if (interval) clearInterval(interval);
        setState('pending');
      }
    };

    void checkPayment();
    interval = setInterval(() => void checkPayment(), 2000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [reference, user, authLoading, clearCart]);

  if (state === 'checking') {
    return (
      <div className="section-padding py-20 min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-gold-400/10 border border-gold-400/30 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-gold-400 animate-spin" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white mb-3">Confirming Payment</h1>
          <p className="text-ink-400">You are back on Vast Nation. We are waiting for Paystack to confirm your payment.</p>
          <p className="text-xs text-ink-500 mt-4 font-mono break-all">Reference: {reference}</p>
        </div>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div className="section-padding py-20 min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-gold-400/10 border border-gold-400/30 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-gold-400" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white mb-3">Payment Is Being Confirmed</h1>
          <p className="text-ink-400 mb-3">
            Paystack has returned you to Vast Nation, but the server confirmation is still processing.
          </p>
          <p className="text-sm text-ink-500 mb-8">
            Your cart has not been cleared because we only clear it after confirmed payment.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/dashboard" className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider">View Dashboard</Link>
            <Link to="/shop" className="btn-outline rounded-lg px-6 py-3 text-sm uppercase tracking-wider">Continue Shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="section-padding py-20 min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white mb-3">Payment Not Confirmed</h1>
          <p className="text-ink-400 mb-8">
            Your order was not confirmed as paid. If money was deducted, please wait for your payment provider to reconcile it before trying again.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/checkout" className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider">Return to Checkout</Link>
            <Link to="/dashboard" className="btn-outline rounded-lg px-6 py-3 text-sm uppercase tracking-wider">View Orders</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-padding py-20 min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-lg">
        <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h1 className="font-display text-3xl font-bold text-white mb-3">Payment Successful</h1>
        <p className="text-ink-400 mb-2">Thank you. Your payment has been confirmed and your cart has been cleared.</p>
        {order && (
          <div className="glass rounded-xl p-5 my-6 text-left space-y-2">
            <div className="flex justify-between"><span className="text-ink-500">Order</span><span className="text-white font-mono">{order.order_number}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Amount</span><span className="text-white">{formatNaira(Number(order.total))}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Reference</span><span className="text-white font-mono text-xs break-all text-right ml-4">{reference}</span></div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/dashboard" className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider">View Order</Link>
          <Link to="/shop" className="btn-outline rounded-lg px-6 py-3 text-sm uppercase tracking-wider">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
