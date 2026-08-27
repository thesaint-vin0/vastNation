/*
============================================================
VAST NATION
PAYMENT HISTORY + REALTIME SYNCHRONIZATION
============================================================
*/

/*
------------------------------------------------------------
1. Prevent duplicate payment records
------------------------------------------------------------
*/

CREATE UNIQUE INDEX IF NOT EXISTS payments_reference_unique_idx
ON public.payments (reference);


/*
------------------------------------------------------------
2. Enable realtime for payments
------------------------------------------------------------
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE public.payments;
  END IF;
END
$$;


/*
------------------------------------------------------------
3. Enable realtime updates for orders
------------------------------------------------------------
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE public.orders;
  END IF;
END
$$;


/*
------------------------------------------------------------
4. Full row information for realtime UPDATE events
------------------------------------------------------------
*/

ALTER TABLE public.payments
REPLICA IDENTITY FULL;

ALTER TABLE public.orders
REPLICA IDENTITY FULL;