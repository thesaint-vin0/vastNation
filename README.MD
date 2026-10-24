# Vast Nation Upgrade

This version adds:

- Expanded customer Account Settings backed by Supabase.
- Password change and global sign-out.
- Account deletion through a protected Edge Function.
- Persistent notification preferences.
- Admin profile and store settings.
- Configurable shipping threshold and shipping fees through checkout settings.
- Coupon editing.
- Coupon activation/deactivation.
- Coupon start/expiry dates.
- Total and per-customer coupon usage limits.
- Coupon usage tracking and historical backfill.
- Paystack callback redirect to `/payment/callback`.
- Callback polling against the order record instead of assuming success.
- Automatic cart clearing only after `payment_status = paid`.
- Paystack initialization authentication and order ownership checks.
- Paystack amount verification against the database order total.
- Idempotent payment-history synchronization.
- Coupon redemption after confirmed payment.
- Correct free-shipping threshold of ₦100,000.
- Realtime coupon updates in the admin dashboard.

## Supabase migration

Run:

```bash
supabase db push
```

The new migration is:

`supabase/migrations/20260827000001_account_coupon_admin_settings.sql`

## Edge Functions

Deploy:

```bash
supabase functions deploy paystack-initialize
supabase functions deploy paystack-webhook --no-verify-jwt
supabase functions deploy delete-account
```

`paystack-webhook` must remain callable by Paystack, so JWT verification must be disabled for that webhook only.

`paystack-initialize` and `delete-account` should keep normal JWT verification enabled.

## Paystack

Keep `PAYSTACK_SECRET_KEY` in Supabase secrets only.

The browser sends the current site origin as:

`<current-origin>/payment/callback`

The customer is therefore returned to the same Vast Nation site after Paystack checkout.

Configure the Paystack webhook URL as:

`https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/paystack-webhook`

## Cart clearing

The cart is NOT cleared when the user starts payment.

It is cleared only after the callback page sees the order's payment status become `paid`.

This prevents failed/cancelled payments from destroying the customer's cart.

## Important

After applying the migration, test:

1. Create a coupon with a usage limit of 1.
2. Apply it to a checkout.
3. Complete payment.
4. Confirm the order becomes paid.
5. Confirm the cart becomes empty.
6. Confirm a payment record exists.
7. Confirm coupon usage becomes 1.
8. Confirm another customer cannot reuse a one-use coupon.
9. Return to the site using Paystack's callback.
10. Change an admin shipping threshold and verify checkout uses the new value.
