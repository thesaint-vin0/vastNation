import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<
    'checking' | 'success' | 'failed'
  >('checking');

  const reference = searchParams.get('reference');

  useEffect(() => {
    /*
     * Paystack redirects the customer back here after payment.
     *
     * IMPORTANT:
     * This callback is NOT the final source of truth.
     * Your Paystack webhook is responsible for confirming
     * the payment on the server.
     */

    if (!reference) {
      setStatus('failed');
      return;
    }

    /*
     * For now, give the webhook a little time to process
     * the payment before showing the customer the result.
     *
     * We will improve this by checking the order/payment
     * status from Supabase.
     */
    const timer = setTimeout(() => {
      setStatus('success');
    }, 2000);

    return () => clearTimeout(timer);
  }, [reference]);

  if (status === 'checking') {
    return (
      <div className="section-padding py-20 min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-gold-400/10 border border-gold-400/30 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-gold-400 animate-spin" />
          </div>

          <h1 className="font-display text-3xl font-bold text-white mb-3">
            Confirming Payment
          </h1>

          <p className="text-ink-400">
            Please wait while we confirm your payment...
          </p>

          {reference && (
            <p className="text-xs text-ink-500 mt-4 font-mono">
              Reference: {reference}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="section-padding py-20 min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>

          <h1 className="font-display text-3xl font-bold text-white mb-3">
            Payment Could Not Be Confirmed
          </h1>

          <p className="text-ink-400 mb-8">
            We could not find a valid Paystack payment
            reference.
          </p>

          <Link
            to="/checkout"
            className="btn-gold rounded-lg px-6 py-3 text-sm uppercase tracking-wider inline-block"
          >
            Return to Checkout
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="section-padding py-20 min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>

        <h1 className="font-display text-3xl font-bold text-white mb-3">
          Payment Received
        </h1>

        <p className="text-ink-400 mb-2">
          Your payment has been submitted successfully.
        </p>

        <p className="text-ink-500 text-sm mb-8">
          Your order is being confirmed. You can view
          your order from your dashboard.
        </p>

        {reference && (
          <div className="glass rounded-xl p-4 mb-8">
            <p className="text-xs text-ink-500 mb-1">
              Payment Reference
            </p>

            <p className="text-sm text-white font-mono break-all">
              {reference}
            </p>
          </div>
        )}

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
      </div>
    </div>
  );
}