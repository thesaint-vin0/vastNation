export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  category_id: string | null;
  images: string[];
  sizes: string[];
  colors: string[];
  stock: number;
  badge: string | null;
  is_featured: boolean;
  is_new: boolean;
  is_bestseller: boolean;
  is_trending: boolean;
  is_limited: boolean;
  rating: number;
  review_count: number;
  created_at: string;
};

export type Review = {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
};

export type Coupon = {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_order: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

export type Address = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  country: string;
  is_default: boolean;
  created_at: string;
};

export type Order = {
  id: string;
  user_id: string;
  order_number: string;

  status:
    | 'pending'
    | 'processing'
    | 'shipping'
    | 'delivered'
    | 'cancelled';

  subtotal: number;
  discount: number;
  shipping: number;
  total: number;

  coupon_code: string | null;
  shipping_address: Record<string, unknown> | null;
  delivery_method: string;

  payment_ref: string | null;
  payment_reference?: string | null;

  payment_status:
    | 'pending'
    | 'paid'
    | 'failed'
    | 'refunded';

  paid_at?: string | null;
  payment_method?: string | null;
  paystack_transaction_id?: number | null;

  created_at: string;
};
export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  image_url: string | null;
  size: string | null;
  color: string | null;
  price: number;
  quantity: number;
  created_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  user_id: string;
  reference: string;
  amount: number;
  status: string;
  channel: string;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'customer' | 'admin';
  avatar_url: string | null;
  created_at: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
  size: string;
  color: string;
};
