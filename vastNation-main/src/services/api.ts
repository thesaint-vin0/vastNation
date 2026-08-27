import { supabase } from '../lib/supabase';
import type { Product, Category, Review, Coupon, Profile, Address, Order, OrderItem, Payment } from '../types';

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProducts(params?: {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  limit?: number;
  featured?: boolean;
  isNew?: boolean;
  bestseller?: boolean;
  trending?: boolean;
  limited?: boolean;
}): Promise<Product[]> {
  let query = supabase.from('products').select('*, category:categories(*)');
  if (params?.category) {
    query = query.eq('category_id', params.category);
  }
  if (params?.search) {
    query = query.ilike('name', `%${params.search}%`);
  }
  if (params?.minPrice !== undefined) {
    query = query.gte('price', params.minPrice);
  }
  if (params?.maxPrice !== undefined) {
    query = query.lte('price', params.maxPrice);
  }
  if (params?.featured) query = query.eq('is_featured', true);
  if (params?.isNew) query = query.eq('is_new', true);
  if (params?.bestseller) query = query.eq('is_bestseller', true);
  if (params?.trending) query = query.eq('is_trending', true);
  if (params?.limited) query = query.eq('is_limited', true);

  switch (params?.sort) {
    case 'price-asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price-desc':
      query = query.order('price', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'rating':
      query = query.order('rating', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }
  if (params?.limit) query = query.limit(params.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRelatedProducts(categoryId: string, excludeId: string, limit = 4): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('category_id', categoryId)
    .neq('id', excludeId)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getReviews(productId: string): Promise<(Review & { profile: Profile | null })[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, profile:profiles(id, email, full_name, avatar_url)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addReview(
  productId: string,
  userId: string,
  rating: number,
  title: string,
  comment: string,
): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      product_id: productId,
      user_id: userId,
      rating,
      title: title.trim() || null,
      comment: comment.trim(),
    })
    .select('*')
    .single();

  if (error) throw error;

  return data;
}
export async function validateCoupon(
  code: string,
  userId?: string,
): Promise<Coupon | null> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .eq('active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const coupon = data as Coupon;
  const now = Date.now();

  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return null;
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) return null;
  if (
    coupon.usage_limit !== null &&
    Number(coupon.usage_count ?? 0) >= Number(coupon.usage_limit)
  ) return null;

  if (userId && coupon.per_user_limit !== null) {
    const { count, error: usageError } = await supabase
      .from('coupon_usage')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId);

    if (usageError) throw usageError;
    if ((count ?? 0) >= Number(coupon.per_user_limit)) return null;
  }

  return coupon;
}

export async function getCoupons(): Promise<Coupon[]> {
  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<void> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
}

export async function getAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addAddress(address: Omit<Address, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('addresses').insert(address);
  if (error) throw error;
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await supabase.from('addresses').delete().eq('id', id);
  if (error) throw error;
}

export async function getOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase.from('order_items').select('*').eq('order_id', orderId);
  if (error) throw error;
  return data ?? [];
}

export async function getPayments(userId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getWishlist(userId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('wishlist')
    .select('product:products(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((item) => item.product).filter(Boolean) as unknown as Product[];
}

export async function addToWishlist(userId: string, productId: string): Promise<void> {
  const { error } = await supabase.from('wishlist').insert({ user_id: userId, product_id: productId });
  if (error && error.code !== '23505') throw error;
}

export async function removeFromWishlist(userId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from('wishlist')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  if (error) throw error;
}

export async function subscribeNewsletter(email: string): Promise<void> {
  const { error } = await supabase.from('newsletter').insert({ email });
  if (error && error.code !== '23505') throw error;
}

export async function createOrder(
  order: Omit<Order, 'id' | 'created_at'>,
  items: Omit<OrderItem, 'id' | 'created_at' | 'order_id'>[],
): Promise<Order> {
  const { data, error } = await supabase.from('orders').insert(order).select().single();
  if (error) throw error;
  const orderItems = items.map((item) => ({ ...item, order_id: data.id }));
  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;
  return data;
}

export async function updateOrderPayment(
  orderId: string,
  paymentRef: string,
  paymentStatus: string,
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({
      payment_ref: paymentRef,
      payment_status: paymentStatus,
    })
    .eq('id', orderId);

  if (error) throw error;
}
export async function recordPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('payments').insert(payment);
  if (error) throw error;
}

export async function getAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAllReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id,
      product_id,
      user_id,
      rating,
      title,
      comment,
      created_at,
      product:products (
        id,
        name,
        slug
      ),
      profile:profiles (
        id,
        email,
        full_name
      )
    `)
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    console.error('Failed to load reviews:', error);
    throw error;
  }

  return data ?? [];
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) throw error;
}

export async function createProduct(
  product: Omit<Product, 'created_at'>,
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const { error } = await supabase.from('products').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function createCategory(
  category: Omit<Category, 'created_at'>
): Promise<void> {
  const { error } = await supabase.from('categories').insert(category);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

export async function createCoupon(
  coupon: Omit<Coupon, 'id' | 'created_at' | 'usage_count'>,
): Promise<Coupon> {
  const { data, error } = await supabase
    .from('coupons')
    .insert({ ...coupon, usage_count: 0 })
    .select()
    .single();

  if (error) throw error;
  return data as Coupon;
}

export async function updateCoupon(
  id: string,
  updates: Partial<Omit<Coupon, 'id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('coupons')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteCoupon(id: string): Promise<void> {
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) throw error;
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  if (error) throw error;
}


export type UserSettings = {
  user_id: string;
  order_updates: boolean;
  payment_updates: boolean;
  shipping_updates: boolean;
  product_alerts: boolean;
  newsletter: boolean;
  promotional_offers: boolean;
  theme: 'system' | 'light' | 'dark';
  updated_at: string;
};

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as UserSettings | null;
}

export async function upsertUserSettings(
  userId: string,
  updates: Partial<Omit<UserSettings, 'user_id' | 'updated_at'>>,
): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: userId, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as UserSettings;
}

export type StoreSettings = {
  id: string;
  store_name: string;
  store_email: string;
  store_phone: string;
  store_address: string;
  currency: string;
  shipping_threshold: number;
  default_shipping_fee: number;
  express_shipping_fee: number;
  tax_rate: number;
  maintenance_mode: boolean;
  notify_new_order: boolean;
  notify_payment: boolean;
  notify_low_stock: boolean;
  notify_new_review: boolean;
  updated_by: string | null;
  updated_at: string;
};

export async function getStoreSettings(): Promise<StoreSettings | null> {
  const { data, error } = await supabase
    .from('store_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as StoreSettings | null;
}

export async function upsertStoreSettings(
  updates: Omit<StoreSettings, 'id' | 'updated_by' | 'updated_at'>,
  updatedBy: string,
): Promise<StoreSettings> {
  const { data, error } = await supabase
    .from('store_settings')
    .upsert(
      {
        id: '00000000-0000-0000-0000-000000000001',
        ...updates,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as StoreSettings;
}

export async function deleteAccount(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error('You are not signed in.');

  const { error } = await supabase.functions.invoke('delete-account', {
    body: { userId: user.id },
  });

  if (error) throw error;
}


export type CheckoutSettings = {
  shipping_threshold: number;
  default_shipping_fee: number;
  express_shipping_fee: number;
};

export async function getCheckoutSettings(): Promise<CheckoutSettings> {
  const { data, error } = await supabase.rpc('get_checkout_settings');
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    shipping_threshold: Number(row?.shipping_threshold ?? 100000),
    default_shipping_fee: Number(row?.default_shipping_fee ?? 2500),
    express_shipping_fee: Number(row?.express_shipping_fee ?? 5000),
  };
}
