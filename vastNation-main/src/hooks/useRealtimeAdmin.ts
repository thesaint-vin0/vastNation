import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface RealtimeAdminOptions {
  onOrdersChange?: () => void;
  onCustomersChange?: () => void;
  onReviewsChange?: () => void;
  onCouponsChange?: () => void;
}

export function useRealtimeAdmin({
  onOrdersChange,
  onCustomersChange,
  onReviewsChange,
  onCouponsChange,
}: RealtimeAdminOptions) {
  useEffect(() => {
    const channel = supabase
      .channel('vast-nation-admin-realtime')

      // Orders
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('ORDER REALTIME:', payload);
          onOrdersChange?.();
        },
      )

      // Customers / Profiles
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          console.log('CUSTOMER REALTIME:', payload);
          onCustomersChange?.();
        },
      )

      // Reviews
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
        },
        (payload) => {
          console.log('REVIEW REALTIME:', payload);
          onReviewsChange?.();
        },
      )

      // Coupons
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coupons',
        },
        (payload) => {
          console.log('COUPON REALTIME:', payload);
          onCouponsChange?.();
        },
      )

      .subscribe((status) => {
        console.log(
          'ADMIN REALTIME STATUS:',
          status,
        );
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    onOrdersChange,
    onCustomersChange,
    onReviewsChange,
    onCouponsChange,
  ]);
}