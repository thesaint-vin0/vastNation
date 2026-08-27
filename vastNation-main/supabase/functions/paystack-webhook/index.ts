import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Required Paystack/Supabase secrets are not configured.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function generateHmacSha512(secret: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeCompare(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) return json({ error: 'Missing signature' }, 401);

    const expectedSignature = await generateHmacSha512(
      PAYSTACK_SECRET_KEY,
      rawBody,
    );

    if (!safeCompare(signature, expectedSignature)) {
      return json({ error: 'Invalid signature' }, 401);
    }

    const payload = JSON.parse(rawBody);

    // Paystack can send many event types. Payment completion is handled here.
    if (payload.event !== 'charge.success') {
      return json({ received: true });
    }

    const transaction = payload.data;
    const reference = transaction?.reference;

    if (!reference) return json({ error: 'Missing transaction reference' }, 400);

    // Always verify the transaction directly with Paystack.
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const verifyResult = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyResult.status) {
      console.error('Paystack verification failed:', verifyResult);
      return json({ error: 'Paystack verification failed' }, 400);
    }

    const verified = verifyResult.data;

    if (verified.status !== 'success') {
      return json({
        received: true,
        payment_status: verified.status,
      });
    }

    const metadata = verified.metadata ?? {};
    const metadataOrderId =
      typeof metadata === 'object' &&
      metadata !== null &&
      'order_id' in metadata
        ? String(metadata.order_id)
        : null;

    let order: {
      id: string;
      user_id: string;
      total: number | string;
      payment_status: string | null;
      payment_reference: string | null;
      payment_ref: string | null;
      coupon_code: string | null;
    } | null = null;

    let orderError = null;

    if (metadataOrderId) {
      const result = await supabase
        .from('orders')
        .select(
          'id,user_id,total,payment_status,payment_reference,payment_ref,coupon_code',
        )
        .eq('id', metadataOrderId)
        .maybeSingle();

      order = result.data;
      orderError = result.error;
    }

    if (!order && !orderError) {
      const result = await supabase
        .from('orders')
        .select(
          'id,user_id,total,payment_status,payment_reference,payment_ref,coupon_code',
        )
        .or(`payment_reference.eq.${reference},payment_ref.eq.${reference}`)
        .maybeSingle();

      order = result.data;
      orderError = result.error;
    }

    if (orderError) {
      console.error('Failed to find order:', orderError);
      return json({ error: 'Failed to find order' }, 500);
    }

    if (!order) {
      console.error('No order found for reference:', reference);
      return json({ error: 'Order not found' }, 404);
    }

    const paidAmount = Number(verified.amount) / 100;
    const orderTotal = Number(order.total);

    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - orderTotal) > 0.01) {
      console.error('Payment amount mismatch', {
        reference,
        paidAmount,
        orderTotal,
      });
      return json({ error: 'Payment amount mismatch' }, 400);
    }

    // Update the order if it is not already paid. Repeated webhooks remain safe.
    if (order.payment_status !== 'paid') {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_reference: reference,
          payment_ref: reference,
          paid_at: new Date().toISOString(),
          payment_method: verified.channel ?? null,
          paystack_transaction_id: verified.id ?? null,
        })
        .eq('id', order.id);

      if (updateError) {
        console.error('Failed to update order:', updateError);
        return json({ error: 'Failed to update order' }, 500);
      }
    }

    // Keep payment history idempotent.
    const { error: paymentError } = await supabase
      .from('payments')
      .upsert(
        {
          order_id: order.id,
          user_id: order.user_id,
          reference,
          amount: paidAmount,
          status: 'success',
          channel: verified.channel ?? 'paystack',
        },
        { onConflict: 'reference' },
      );

    if (paymentError) {
      console.error('Payment history synchronization failed:', paymentError);
      // The order is already paid; Paystack should still receive 200.
    }

    // Count the coupon only after the payment is confirmed.
    if (order.coupon_code) {
      const { data: couponRedeemed, error: couponError } = await supabase.rpc(
        'redeem_coupon',
        {
          p_coupon_code: order.coupon_code,
          p_user_id: order.user_id,
          p_order_id: order.id,
        },
      );

      if (couponError) {
        console.error('Coupon redemption failed:', couponError);
      } else if (!couponRedeemed) {
        console.warn('Coupon could not be redeemed after successful payment:', {
          orderId: order.id,
          coupon: order.coupon_code,
        });
      }
    }

    console.log('Payment successfully confirmed:', {
      orderId: order.id,
      reference,
      amount: paidAmount,
      transactionId: verified.id,
      channel: verified.channel,
    });

    return json({
      received: true,
      success: true,
      order_id: order.id,
      reference,
    });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
    );
  }
});
