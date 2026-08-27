import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PAYSTACK_SECRET_KEY) {
  throw new Error('Required Supabase/Paystack secrets are not configured.');
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const token = authorization.slice('Bearer '.length);
    const { data: authData, error: authError } = await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return json({ error: 'Invalid authentication session.' }, 401);
    }

    const user = authData.user;
    const body = await req.json();

    const email = String(body.email ?? '').trim();
    const orderId = String(body.orderId ?? '').trim();
    const callbackUrl = String(body.callback_url ?? '').trim();
    const requestedAmount = Number(body.amount);

    if (!email || !orderId || !callbackUrl) {
      return json({ error: 'Email, orderId and callback_url are required.' }, 400);
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id,user_id,total,payment_status,payment_reference,payment_ref')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      console.error('Order lookup failed:', orderError);
      return json({ error: 'Could not load your order.' }, 500);
    }

    if (!order) return json({ error: 'Order not found.' }, 404);
    if (order.user_id !== user.id) return json({ error: 'You cannot pay for this order.' }, 403);

    if (order.payment_status === 'paid') {
      return json({ error: 'This order has already been paid.' }, 409);
    }

    const orderAmount = Number(order.total);
    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      return json({ error: 'The order has an invalid total.' }, 400);
    }

    // The database order total is authoritative. The browser cannot change
    // the amount sent to Paystack by supplying a different amount.
    if (Number.isFinite(requestedAmount) && Math.abs(requestedAmount - orderAmount) > 0.01) {
      console.warn('Client amount differed from order total; using database total.', {
        orderId,
        requestedAmount,
        orderAmount,
      });
    }

    const reference =
      String(body.reference ?? '').trim() ||
      `VN-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const amountInKobo = Math.round(orderAmount * 100);

    const paystackResponse = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: String(amountInKobo),
          currency: 'NGN',
          reference,
          callback_url: callbackUrl,
          metadata: {
            order_id: order.id,
            user_id: user.id,
          },
        }),
      },
    );

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      console.error('Paystack initialization failed:', paystackData);
      return json(
        { error: paystackData.message || 'Paystack initialization failed.' },
        400,
      );
    }

    const realReference = paystackData.data.reference || reference;

    const { error: referenceError } = await admin
      .from('orders')
      .update({
        payment_ref: realReference,
        payment_reference: realReference,
      })
      .eq('id', order.id)
      .eq('user_id', user.id);

    if (referenceError) {
      console.error('Failed to save Paystack reference:', referenceError);
      return json({ error: 'Could not link the payment to your order.' }, 500);
    }

    return json({
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference: realReference,
    });
  } catch (error) {
    console.error('Paystack initialization error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Internal server error.' },
      500,
    );
  }
});
