import type { Coupon } from '../types';

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function generateOrderNumber(): string {
  const prefix = 'VN';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${timestamp}${random}`;
}

export function generateReference(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `vn-${timestamp}-${random}`;
}

export function classNames(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function discountPercent(price: number, compareAt: number | null): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function calculateDiscount(
  subtotal: number,
  coupon: Coupon | null,
): number {
  if (!coupon) return 0;
  if (subtotal < coupon.min_order) return 0;
  if (coupon.type === 'percent') {
    return Math.round((subtotal * coupon.value) / 100);
  }
  return Math.min(coupon.value, subtotal);
}

export type ShippingSettings = {
  shipping_threshold: number;
  default_shipping_fee: number;
  express_shipping_fee: number;
};

export function calculateShipping(
  subtotal: number,
  deliveryMethod: string,
  settings: ShippingSettings = {
    shipping_threshold: 100000,
    default_shipping_fee: 2500,
    express_shipping_fee: 5000,
  },
): number {
  if (deliveryMethod === 'express') return settings.express_shipping_fee;
  if (subtotal >= settings.shipping_threshold) return 0;
  return settings.default_shipping_fee;
}
