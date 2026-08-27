-- Enable realtime for customer payment updates.
-- Safe to run even if the table is already in the publication.

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

-- Send complete old rows for UPDATE/DELETE events.
ALTER TABLE public.payments
REPLICA IDENTITY FULL;

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

ALTER TABLE public.orders
REPLICA IDENTITY FULL;