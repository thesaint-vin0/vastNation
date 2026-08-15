import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { Product, CartItem } from '../types';

type CartState = {
  items: CartItem[];
};

type CartAction =
  | { type: 'ADD_ITEM'; product: Product; quantity: number; size: string; color: string }
  | { type: 'REMOVE_ITEM'; productId: string; size: string; color: string }
  | { type: 'UPDATE_QTY'; productId: string; size: string; color: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; items: CartItem[] };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(
        (i) => i.product.id === action.product.id && i.size === action.size && i.color === action.color,
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i === existing ? { ...i, quantity: i.quantity + action.quantity } : i,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          { product: action.product, quantity: action.quantity, size: action.size, color: action.color },
        ],
      };
    }
    case 'REMOVE_ITEM':
      return {
        items: state.items.filter(
          (i) => !(i.product.id === action.productId && i.size === action.size && i.color === action.color),
        ),
      };
    case 'UPDATE_QTY':
      return {
        items: state.items.map((i) =>
          i.product.id === action.productId && i.size === action.size && i.color === action.color
            ? { ...i, quantity: Math.max(1, action.quantity) }
            : i,
        ),
      };
    case 'CLEAR':
      return { items: [] };
    case 'HYDRATE':
      return { items: action.items };
    default:
      return state;
  }
}

type CartContextType = {
  items: CartItem[];
  addItem: (product: Product, quantity: number, size: string, color: string) => void;
  removeItem: (productId: string, size: string, color: string) => void;
  updateQuantity: (productId: string, size: string, color: string, quantity: number) => void;
  clearCart: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = 'vn_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const items = JSON.parse(stored) as CartItem[];
        dispatch({ type: 'HYDRATE', items });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const count = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const value: CartContextType = {
    items: state.items,
    addItem: (product, quantity, size, color) =>
      dispatch({ type: 'ADD_ITEM', product, quantity, size, color }),
    removeItem: (productId, size, color) => dispatch({ type: 'REMOVE_ITEM', productId, size, color }),
    updateQuantity: (productId, size, color, quantity) =>
      dispatch({ type: 'UPDATE_QTY', productId, size, color, quantity }),
    clearCart: () => dispatch({ type: 'CLEAR' }),
    count,
    subtotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
