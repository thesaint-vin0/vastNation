-- Keep products.rating and products.review_count synchronized
-- whenever a review is inserted, updated, or deleted.

CREATE OR REPLACE FUNCTION public.sync_product_review_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_product_id uuid;
BEGIN
  target_product_id := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE public.products
  SET
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE product_id = target_product_id
    ),
    rating = COALESCE(
      (
        SELECT ROUND(AVG(rating)::numeric, 1)
        FROM public.reviews
        WHERE product_id = target_product_id
      ),
      0
    )
  WHERE id = target_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_product_review_stats_trigger
ON public.reviews;

CREATE TRIGGER sync_product_review_stats_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_review_stats();