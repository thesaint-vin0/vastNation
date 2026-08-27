import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<'checking' | 'success' | 'failed'>('checking');
  const [message, setMessage] = useState('Please wait while we confirm your payment…');
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  useEffect(() => {
    if (!reference) { setStatus('failed'); setMessage('No Paystack reference was supplied.'); return; }
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      const { data, error } = await supabase.from('orders').select('id,payment_status,payment_reference,payment_ref').or(`payment_reference.eq.${reference},payment_ref.eq.${reference}`).maybeSingle();
      if (cancelled) return;
      if (error) { setMessage('We are still confirming the transaction…'); return; }
      if (data?.payment_status === 'paid') { setStatus('success'); clearCart(); return; }
      if (data?.payment_status === 'failed' || data?.payment_status === 'refunded') { setStatus('failed'); setMessage('The payment was not completed. Your cart has been kept.'); return; }
      setMessage('Payment received by Paystack. Waiting for final confirmation…');
    };

    void check();
    channel = supabase.channel(`payment-callback-${reference}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `payment_ref=eq.${reference}` }, (payload) => {
        const row = payload.new as { payment_status?: string };
        if (row.payment_status === 'paid') { setStatus('success'); clearCart(); }
        if (row.payment_status === 'failed' || row.payment_status === 'refunded') setStatus('failed');
      }).subscribe();
    timer = setInterval(() => void check(), 2000);
    const stop = setTimeout(() => { if (!cancelled) { setStatus((current) => current === 'checking' ? 'failed' : current); setMessage('We could not confirm the payment yet. Check your Orders page before trying again.'); } }, 45000);
    return () => { cancelled = true; if (timer) clearInterval(timer); clearTimeout(stop); if (channel) void supabase.removeChannel(channel); };
  }, [reference, clearCart]);

  if (status === 'checking') return <div className="section-padding py-20 min-h-[60vh] flex items-center justify-center"><div className="text-center"><div className="w-20 h-20 rounded-full bg-gold-400/10 border border-gold-400/30 flex items-center justify-center mx-auto mb-6"><Loader2 className="w-10 h-10 text-gold-400 animate-spin" /></div><h1 className="font-display text-3xl font-bold text-white mb-3">Confirming Payment</h1><p className="text-ink-400 max-w-md mx-auto">{message}</p><p className="text-xs text-ink-500 mt-4 font-mono break-all">Reference: {reference}</p></div></div>;
  if (status === 'failed') return <div className="section-padding py-20 min-h-[60vh] flex items-center justify-center"><div className="text-center max-w-md"><div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6"><XCircle className="w-10 h-10 text-red-400" /></div><h1 className="font-display text-3xl font-bold text-white mb-3">Payment Not Confirmed</h1><p className="text-ink-400 mb-8">{message}</p><div className="flex justify-center gap-3"><Link to="/dashboard" className="btn-gold px-5 py-3 rounded-lg">View Orders</Link><Link to="/cart" className="btn-outline px-5 py-3 rounded-lg">Return to Cart</Link></div></div></div>;
  return <div className="section-padding py-20 min-h-[60vh] flex items-center justify-center"><div className="text-center max-w-md"><div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-green-400" /></div><h1 className="font-display text-3xl font-bold text-white mb-3">Payment Successful</h1><p className="text-ink-400 mb-8">Your payment has been confirmed. Your cart has been cleared and your order is now available in your dashboard.</p><div className="flex justify-center gap-3"><Link to="/dashboard" className="btn-gold px-5 py-3 rounded-lg">View Order</Link><Link to="/shop" className="btn-outline px-5 py-3 rounded-lg">Continue Shopping</Link></div></div></div>;
}
