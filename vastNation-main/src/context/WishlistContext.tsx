import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getWishlist, addToWishlist, removeFromWishlist } from '../services/api';
import type { Product } from '../types';

type WishlistContextType = {
  items: Product[];
  loading: boolean;
  toggle: (product: Product) => Promise<void>;
  has: (productId: string) => boolean;
  count: number;
};

const WishlistContext = createContext<WishlistContextType | null>(null);

const STORAGE_KEY = 'vn_wishlist_guest';

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setItems(JSON.parse(stored));
      } catch {
        // ignore
      }
      return;
    }
    setLoading(true);
    getWishlist(user.id)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, user]);

  const toggle = useCallback(
    async (product: Product) => {
      const exists = items.some((i) => i.id === product.id);
      if (exists) {
        setItems((prev) => prev.filter((i) => i.id !== product.id));
        if (user) await removeFromWishlist(user.id, product.id);
      } else {
        setItems((prev) => [...prev, product]);
        if (user) await addToWishlist(user.id, product.id);
      }
    },
    [items, user],
  );

  const has = useCallback((productId: string) => items.some((i) => i.id === productId), [items]);

  return (
    <WishlistContext.Provider value={{ items, loading, toggle, has, count: items.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
