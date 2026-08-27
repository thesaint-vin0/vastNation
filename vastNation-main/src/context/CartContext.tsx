import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { Product, CartItem } from '../types';

type CartState = { items: CartItem[] };

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
        (item) =>
          item.product.id === action.product.id &&
          item.size === action.size &&
          item.color === action.color,
      );

      if (existing) {
        return {
          items: state.items.map((item) =>
            item === existing
              ? { ...item, quantity: item.quantity + action.quantity }
              : item,
          ),
        };
      }

      return {
        items: [
          ...state.items,
          {
            product: action.product,
            quantity: action.quantity,
            size: action.size,
            color: action.color,
          },
        ],
      };
    }

    case 'REMOVE_ITEM':
      return {
        items: state.items.filter(
          (item) =>
            !(
              item.product.id === action.productId &&
              item.size === action.size &&
              item.color === action.color
            ),
        ),
      };

    case 'UPDATE_QTY':
      return {
        items: state.items.map((item) =>
          item.product.id === action.productId &&
          item.size === action.size &&
          item.color === action.color
            ? { ...item, quantity: Math.max(1, action.quantity) }
            : item,
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
      if (!stored) return;

      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        dispatch({ type: 'HYDRATE', items: parsed as CartItem[] });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const addItem = useCallback(
    (product: Product, quantity: number, size: string, color: string) =>
      dispatch({ type: 'ADD_ITEM', product, quantity, size, color }),
    [],
  );

  const removeItem = useCallback(
    (productId: string, size: string, color: string) =>
      dispatch({ type: 'REMOVE_ITEM', productId, size, color }),
    [],
  );

  const updateQuantity = useCallback(
    (productId: string, size: string, color: string, quantity: number) =>
      dispatch({ type: 'UPDATE_QTY', productId, size, color, quantity }),
    [],
  );

  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const value = useMemo<CartContextType>(() => {
    const count = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    return {
      items: state.items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      count,
      subtotal,
    };
  }, [state.items, addItem, removeItem, updateQuantity, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
