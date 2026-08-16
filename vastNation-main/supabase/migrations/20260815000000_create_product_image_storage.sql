-- Create public product image bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Anyone can view product images
DROP POLICY IF EXISTS "Public can view product images"
ON storage.objects;

CREATE POLICY "Public can view product images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'product-images'
);

-- Only authenticated admins can upload
DROP POLICY IF EXISTS "Admins can upload product images"
ON storage.objects;

CREATE POLICY "Admins can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only authenticated admins can update
DROP POLICY IF EXISTS "Admins can update product images"
ON storage.objects;

CREATE POLICY "Admins can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only authenticated admins can delete
DROP POLICY IF EXISTS "Admins can delete product images"
ON storage.objects;

CREATE POLICY "Admins can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);