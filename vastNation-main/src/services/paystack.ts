import { supabase } from '../lib/supabase';

type InitializePaymentResponse = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export async function initializePaystackPayment(
  email: string,
  amount: number,
  orderId: string,
) {
  const callbackUrl = `${window.location.origin}/payment/callback`;

  const { data, error } = await supabase.functions.invoke(
    'paystack-initialize',
    {
      body: {
        email,
        amount,
        orderId,
        callback_url: callbackUrl,
      },
    },
  );

  if (error) throw error;
  if (!data?.authorization_url) {
    throw new Error('Paystack authorization URL was not returned.');
  }
  if (!data?.reference) {
    throw new Error('Paystack payment reference was not returned.');
  }

  return data as InitializePaymentResponse;
}
