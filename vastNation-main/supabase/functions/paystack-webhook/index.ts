import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SECRET_KEY =
  Deno.env.get('PAYSTACK_SECRET_KEY');

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL');

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!PAYSTACK_SECRET_KEY) {
  throw new Error('PAYSTACK_SECRET_KEY is not configured');
}

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL is not configured');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY is not configured',
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

async function generateHmacSha512(
  secret: string,
  body: string,
) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-512',
    },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body),
  );

  return Array.from(
    new Uint8Array(signature),
  )
    .map((byte) =>
      byte.toString(16).padStart(2, '0'),
    )
    .join('');
}

function safeCompare(
  a: string,
  b: string,
) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}

Deno.serve(async (req) => {
  try {
    /*
     * Only accept POST requests.
     */
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: 'Method not allowed',
        }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * Read the raw body.
     *
     * IMPORTANT:
     * We need the raw body to verify Paystack's
     * HMAC SHA-512 signature.
     */
    const rawBody = await req.text();

    const signature =
      req.headers.get(
        'x-paystack-signature',
      );

    if (!signature) {
      console.error(
        'Missing x-paystack-signature',
      );

      return new Response(
        JSON.stringify({
          error: 'Missing signature',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * Verify Paystack signature.
     */
    const expectedSignature =
      await generateHmacSha512(
        PAYSTACK_SECRET_KEY,
        rawBody,
      );

    if (
      !safeCompare(
        signature,
        expectedSignature,
      )
    ) {
      console.error(
        'Invalid Paystack signature',
      );

      return new Response(
        JSON.stringify({
          error: 'Invalid signature',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * Signature is valid.
     */
    const payload = JSON.parse(rawBody);

    console.log(
      'Paystack event:',
      payload.event,
    );

    /*
     * We primarily care about charge.success.
     */
    if (payload.event !== 'charge.success') {
      console.log(
        'Ignoring Paystack event:',
        payload.event,
      );

      return new Response(
        JSON.stringify({
          received: true,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const transaction =
      payload.data;

    const reference =
      transaction?.reference;

    if (!reference) {
      console.error(
        'Paystack event has no reference',
      );

      return new Response(
        JSON.stringify({
          error: 'Missing transaction reference',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * IMPORTANT:
     *
     * Do not trust charge.success by itself.
     *
     * Verify the transaction directly with
     * Paystack's API.
     */
    const verifyResponse =
      await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(
          reference,
        )}`,
        {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type':
              'application/json',
          },
        },
      );

    const verifyResult =
      await verifyResponse.json();

    if (
      !verifyResponse.ok ||
      !verifyResult.status
    ) {
      console.error(
        'Paystack verification failed:',
        verifyResult,
      );

      return new Response(
        JSON.stringify({
          error: 'Paystack verification failed',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const verifiedTransaction =
      verifyResult.data;

    /*
     * Make absolutely sure the verified
     * transaction is successful.
     */
    if (
      verifiedTransaction.status !==
      'success'
    ) {
      console.log(
        'Payment is not successful:',
        verifiedTransaction.status,
      );

      return new Response(
        JSON.stringify({
          received: true,
          payment_status:
            verifiedTransaction.status,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * Get the amount Paystack says was paid.
     *
     * Paystack amount is in kobo.
     */
    const paidAmount =
      Number(verifiedTransaction.amount) / 100;

    /*
     * Find the order.
     */
    const { data: order, error: orderError } =
      await supabase
        .from('orders')
        .select(
          'id, total, payment_status, payment_reference, payment_ref',
        )
        .or(
          `payment_reference.eq.${reference},payment_ref.eq.${reference}`,
        )
        .maybeSingle();

    if (orderError) {
      console.error(
        'Failed to find order:',
        orderError,
      );

      return new Response(
        JSON.stringify({
          error: 'Failed to find order',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    if (!order) {
      console.error(
        'No order found for reference:',
        reference,
      );

      return new Response(
        JSON.stringify({
          error: 'Order not found',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * IMPORTANT SECURITY CHECK
     *
     * Make sure the amount paid matches
     * the order total.
     */
    const orderTotal =
      Number(order.total);

    if (
      Math.abs(
        paidAmount - orderTotal,
      ) > 0.01
    ) {
      console.error(
        'Payment amount mismatch',
        {
          reference,
          paidAmount,
          orderTotal,
        },
      );

      return new Response(
        JSON.stringify({
          error: 'Payment amount mismatch',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * If already paid, don't process it again.
     *
     * This protects against duplicate webhook
     * deliveries.
     */
    if (
      order.payment_status ===
      'paid'
    ) {
      console.log(
        'Order already marked paid:',
        order.id,
      );

      return new Response(
        JSON.stringify({
          received: true,
          already_paid: true,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * Determine the payment channel.
     *
     * Examples:
     * card
     * bank
     * ussd
     * paystack
     */
    const paymentMethod =
      verifiedTransaction.channel ??
      'paystack';

    /*
     * UPDATE THE ORDER
     *
     * This is the important part.
     */
    const {
      error: updateError,
    } = await supabase
      .from('orders')
     .update({
  payment_status: 'paid',
  payment_reference: reference,
  payment_ref: reference,
  paid_at: new Date().toISOString(),
  payment_method:
    verifiedTransaction.channel ?? null,
  paystack_transaction_id:
    verifiedTransaction.id ?? null,
})
      .eq('id', order.id);

    if (updateError) {
      console.error(
        'Failed to update order:',
        updateError,
      );

      return new Response(
        JSON.stringify({
          error:
            'Failed to update order',
        }),
        {
          status: 500,
          headers: {
            'Content-Type':
              'application/json',
          },
        },
      );
    }

    console.log(
      'Payment successfully confirmed:',
      {
        orderId: order.id,
        reference,
        amount: paidAmount,
        transactionId:
          verifiedTransaction.id,
        paymentMethod,
      },
    );

    /*
     * Tell Paystack that we received
     * the webhook successfully.
     */
    return new Response(
      JSON.stringify({
        received: true,
        success: true,
      }),
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/json',
        },
      },
    );
  } catch (error) {
    console.error(
      'Paystack webhook error:',
      error,
    );

    return new Response(
      JSON.stringify({
        error:
          'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type':
            'application/json',
        },
      },
    );
  }
});