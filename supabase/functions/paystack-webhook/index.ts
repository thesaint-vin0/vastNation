import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'content-type, x-paystack-signature',
};

async function generateHmac(
  secret: string,
  payload: string,
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
    encoder.encode(payload),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) =>
      byte.toString(16).padStart(2, '0'),
    )
    .join('');
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |=
      a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders,
      });
    }

    const paystackSecret = Deno.env.get(
      'PAYSTACK_SECRET_KEY',
    );

    if (!paystackSecret) {
      throw new Error(
        'PAYSTACK_SECRET_KEY is not configured',
      );
    }

    const rawBody = await req.text();

    const signature = req.headers.get(
      'x-paystack-signature',
    );

    if (!signature) {
      return new Response('Missing signature', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const expectedSignature =
      await generateHmac(
        paystackSecret,
        rawBody,
      );

    if (
      !safeEqual(
        signature,
        expectedSignature,
      )
    ) {
      return new Response('Invalid signature', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const event = JSON.parse(rawBody);

    console.log(
      'Paystack event:',
      event.event,
    );

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL')!;

    const supabaseServiceKey =
      Deno.env.get(
        'SUPABASE_SERVICE_ROLE_KEY',
      )!;

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
    );

    if (event.event === 'charge.success') {
      const transaction = event.data;

      const reference =
        transaction.reference;

      const metadata =
        transaction.metadata ?? {};

      const orderId =
        metadata.order_id;

      if (!orderId && !reference) {
        return new Response(
          JSON.stringify({
            error: 'Missing order reference',
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type':
                'application/json',
            },
          },
        );
      }

      let query = supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          payment_reference: reference,
          payment_method:
            transaction.channel ?? null,
          paystack_transaction_id:
            transaction.id ?? null,
        });

      if (orderId) {
        query = query.eq('id', orderId);
      } else {
        query = query.eq(
          'payment_reference',
          reference,
        );
      }

      const { error } = await query;

      if (error) {
        console.error(
          'Failed to update paid order:',
          error,
        );

        throw error;
      }
    }

    return new Response(
      JSON.stringify({
        received: true,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
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
          error instanceof Error
            ? error.message
            : 'Webhook failed',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type':
            'application/json',
        },
      },
    );
  }
});