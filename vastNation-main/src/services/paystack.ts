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
  // Always return to the same site the customer is currently using.
  // This works for both localhost and the deployed Vast Nation domain.
  const callback_url = `${window.location.origin}/payment/callback`;

  const { data, error } = await supabase.functions.invoke(
    'paystack-initialize',
    {
      body: {
        email,
        amount,
        orderId,
        callback_url,
      },
    },
  );

  if (error) {
    throw new Error(error.message || 'Unable to initialize Paystack payment.');
  }

  if (!data) {
    throw new Error('No payment response received.');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.authorization_url) {
    throw new Error('Paystack authorization URL was not returned.');
  }

  if (!data.reference) {
    throw new Error('Paystack payment reference was not returned.');
  }

  return data as InitializePaymentResponse;
}
