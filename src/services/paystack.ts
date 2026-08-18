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
  const { data, error } =
    await supabase.functions.invoke(
      'paystack-initialize',
      {
        body: {
          email,
          amount,
          orderId,
        },
      },
    );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'No payment response received',
    );
  }

  return data as InitializePaymentResponse;
}