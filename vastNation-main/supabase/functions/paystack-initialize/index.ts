import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

serve(async (req) => {
  /*
   * ============================================================
   * CORS PREFLIGHT
   * ============================================================
   *
   * Browsers send OPTIONS before the actual POST request.
   * We MUST return HTTP 200 here.
   */

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  /*
   * Only allow POST requests
   */

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  try {
    /*
     * ==========================================================
     * ENVIRONMENT VARIABLES
     * ==========================================================
     */

    const paystackSecretKey =
      Deno.env.get('PAYSTACK_SECRET_KEY');

    if (!paystackSecretKey) {
      console.error(
        'PAYSTACK_SECRET_KEY is not configured',
      );

      return new Response(
        JSON.stringify({
          error:
            'Paystack secret key is not configured.',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * ==========================================================
     * READ REQUEST
     * ==========================================================
     */

    const {
      email,
      amount,
      orderId,
      callback_url,
    } = await req.json();

    /*
     * Validate required fields
     */

    if (!email) {
      return new Response(
        JSON.stringify({
          error: 'Email is required.',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    if (!amount) {
      return new Response(
        JSON.stringify({
          error: 'Amount is required.',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    if (!orderId) {
      return new Response(
        JSON.stringify({
          error: 'Order ID is required.',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * ==========================================================
     * GENERATE UNIQUE PAYSTACK REFERENCE
     * ==========================================================
     */

    const reference =
      `VN-${orderId}-${crypto.randomUUID()}`;

    /*
     * ==========================================================
     * CONVERT NGN TO KOBO
     * ==========================================================
     *
     * Example:
     *
     * ₦25,000
     *
     * becomes:
     *
     * 2,500,000 kobo
     */

    const amountInKobo = Math.round(
      Number(amount) * 100,
    );

    if (
      !Number.isFinite(amountInKobo) ||
      amountInKobo <= 0
    ) {
      return new Response(
        JSON.stringify({
          error: 'Invalid payment amount.',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * ==========================================================
     * PAYSTACK REQUEST
     * ==========================================================
     */

    const paystackResponse = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          email,

          amount: String(amountInKobo),

          currency: 'NGN',

          reference,

          /*
           * Send customer back to:
           *
           * http://localhost:5173/payment/callback
           *
           * during local development.
           *
           * In production this will become your live domain.
           */

          callback_url,

          /*
           * This allows the webhook to know which
           * Vast Nation order belongs to this payment.
           */

          metadata: {
            order_id: orderId,
          },
        }),
      },
    );

    /*
     * ==========================================================
     * READ PAYSTACK RESPONSE
     * ==========================================================
     */

    const paystackData =
      await paystackResponse.json();

    console.log(
      'Paystack response:',
      paystackData,
    );

    /*
     * ==========================================================
     * PAYSTACK ERROR
     * ==========================================================
     */

    if (
      !paystackResponse.ok ||
      !paystackData.status
    ) {
      console.error(
        'Paystack initialization failed:',
        paystackData,
      );

      return new Response(
        JSON.stringify({
          error:
            paystackData.message ||
            'Paystack initialization failed.',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /*
     * ==========================================================
     * SUCCESS
     * ==========================================================
     */

    return new Response(
      JSON.stringify({
        authorization_url:
          paystackData.data.authorization_url,

        access_code:
          paystackData.data.access_code,

        reference:
          paystackData.data.reference ||
          reference,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    /*
     * ==========================================================
     * UNEXPECTED ERROR
     * ==========================================================
     */

    console.error(
      'Paystack initialization error:',
      error,
    );

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});