/*
============================================================
STEP 3
SEPARATE ORDER STATUS FROM PAYMENT STATUS
============================================================
*/

/*
------------------------------------------------------------
1. Remove the existing order-status constraint FIRST.
------------------------------------------------------------

This must happen before converting existing statuses because
the old production constraint may not allow "processing" or
"shipping".
*/

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_status_check;


/*
------------------------------------------------------------
2. Convert legacy order statuses.
------------------------------------------------------------

Old order statuses:
    paid
    shipped
    failed

New order statuses:
    pending
    processing
    shipping
    delivered
    cancelled

Payment information belongs in payment_status.
*/

UPDATE public.orders
SET status = 'processing'
WHERE status = 'paid';

UPDATE public.orders
SET status = 'shipping'
WHERE status = 'shipped';

UPDATE public.orders
SET status = 'pending'
WHERE status = 'failed';


/*
------------------------------------------------------------
3. Normalize any NULL order statuses.
------------------------------------------------------------
*/

UPDATE public.orders
SET status = 'pending'
WHERE status IS NULL;


/*
------------------------------------------------------------
4. Create the new order-status constraint.
------------------------------------------------------------
*/

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check
CHECK (
  status IN (
    'pending',
    'processing',
    'shipping',
    'delivered',
    'cancelled'
  )
);


/*
------------------------------------------------------------
5. Replace the payment-status constraint.
------------------------------------------------------------
*/

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_payment_status_check;


/*
------------------------------------------------------------
6. Normalize NULL payment statuses.
------------------------------------------------------------

Do this BEFORE adding the new constraint.
*/

UPDATE public.orders
SET payment_status = 'pending'
WHERE payment_status IS NULL;


/*
------------------------------------------------------------
7. Create the payment-status constraint.
------------------------------------------------------------
*/

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_status_check
CHECK (
  payment_status IN (
    'pending',
    'paid',
    'failed',
    'refunded'
  )
);