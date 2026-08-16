import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface RealtimeAdminOptions {
  onOrdersChange?: () => void;
  onCustomersChange?: () => void;
  onReviewsChange?: () => void;
}

export function useRealtimeAdmin({
  onOrdersChange,
  onCustomersChange,
  onReviewsChange,
}: RealtimeAdminOptions) {
  useEffect(() => {
    const channel = supabase
      .channel('vast-nation-admin-realtime')

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

      .subscribe((status) => {
        console.log(
          'ADMIN REALTIME STATUS:',
          status,
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    onOrdersChange,
    onCustomersChange,
    onReviewsChange,
  ]);
}