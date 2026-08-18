import { supabase } from '../lib/supabase';

const BUCKET = 'product-images';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

function validateImage(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      'Invalid image type. Please upload JPG, PNG, WEBP or GIF.',
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Image must be smaller than 5MB.');
  }
}

function createFileName(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';

  return `${crypto.randomUUID()}.${extension}`;
}

export async function uploadProductImage(
  file: File,
  productId: string,
): Promise<string> {
  validateImage(file);

  const fileName = createFileName(file);

  const path = `products/${productId}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function uploadCategoryImage(
  file: File,
  categoryId: string,
): Promise<string> {
  validateImage(file);

  const fileName = createFileName(file);

  const path = `categories/${categoryId}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}
export async function deleteStorageImage(
  publicUrl: string,
): Promise<void> {
  const marker = '/storage/v1/object/public/product-images/';

  const index = publicUrl.indexOf(marker);

  if (index === -1) {
    return;
  }

  const path = publicUrl.substring(
    index + marker.length,
  );

  const { error } = await supabase.storage
    .from('product-images')
    .remove([path]);

  if (error) {
    throw error;
  }
}

