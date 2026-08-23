-- Recalculate a product's review statistics
-- whenever a review is inserted, updated, or deleted.

CREATE OR REPLACE FUNCTION public.sync_product_review_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_product_id uuid;
BEGIN

  -- INSERT
  IF TG_OP = 'INSERT' THEN

    affected_product_id := NEW.product_id;

    UPDATE public.products
    SET
      review_count = (
        SELECT COUNT(*)
        FROM public.reviews
        WHERE product_id = affected_product_id
      ),
      rating = COALESCE(
        (
          SELECT ROUND(AVG(rating)::numeric, 1)
          FROM public.reviews
          WHERE product_id = affected_product_id
        ),
        0
      )
    WHERE id = affected_product_id;

  -- DELETE
  ELSIF TG_OP = 'DELETE' THEN

    affected_product_id := OLD.product_id;

    UPDATE public.products
    SET
      review_count = (
        SELECT COUNT(*)
        FROM public.reviews
        WHERE product_id = affected_product_id
      ),
      rating = COALESCE(
        (
          SELECT ROUND(AVG(rating)::numeric, 1)
          FROM public.reviews
          WHERE product_id = affected_product_id
        ),
        0
      )
    WHERE id = affected_product_id;

  -- UPDATE
  ELSIF TG_OP = 'UPDATE' THEN

    -- Recalculate the old product if the review
    -- was moved to another product.
    IF OLD.product_id IS DISTINCT FROM NEW.product_id THEN

      UPDATE public.products
      SET
        review_count = (
          SELECT COUNT(*)
          FROM public.reviews
          WHERE product_id = OLD.product_id
        ),
        rating = COALESCE(
          (
            SELECT ROUND(AVG(rating)::numeric, 1)
            FROM public.reviews
            WHERE product_id = OLD.product_id
          ),
          0
        )
      WHERE id = OLD.product_id;

    END IF;

    -- Recalculate the new/current product.
    affected_product_id := NEW.product_id;

    UPDATE public.products
    SET
      review_count = (
        SELECT COUNT(*)
        FROM public.reviews
        WHERE product_id = affected_product_id
      ),
      rating = COALESCE(
        (
          SELECT ROUND(AVG(rating)::numeric, 1)
          FROM public.reviews
          WHERE product_id = affected_product_id
        ),
        0
      )
    WHERE id = affected_product_id;

  END IF;

  RETURN COALESCE(NEW, OLD);

END;
$$;


-- Remove the previous trigger if it exists.
DROP TRIGGER IF EXISTS sync_product_review_stats_trigger
ON public.reviews;


-- Create the corrected trigger.
CREATE TRIGGER sync_product_review_stats_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_review_stats();


-- Recalculate ALL existing products.
UPDATE public.products p
SET
  review_count = (
    SELECT COUNT(*)
    FROM public.reviews r
    WHERE r.product_id = p.id
  ),
  rating = COALESCE(
    (
      SELECT ROUND(AVG(r.rating)::numeric, 1)
      FROM public.reviews r
      WHERE r.product_id = p.id
    ),
    0
  );