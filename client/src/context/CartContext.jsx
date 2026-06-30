import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(null);

const STORAGE_KEY = 'tt_cart';

/**
 * CartProvider
 * ─────────────────────────────────────────────────────────────────
 * Persists cart to localStorage so it survives page refreshes.
 *
 * Cart item shape:
 *   {
 *     _id:      string   product id
 *     title:    string
 *     price:    number
 *     image:    string
 *     stock:    number   max the buyer can order
 *     seller:   { _id, name, sellerProfile.shopName }
 *     sellerId: string   denormalised for quick same-seller check
 *     quantity: number
 *   }
 *
 * Constraint: all items must be from the same seller (escrow rule).
 * Adding a product from a different seller clears the cart first.
 */
export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage full — fail silently
    }
  }, [items]);

  // ── Derived values ────────────────────────────────────────────
  const totalItems    = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount   = parseFloat(
    items.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2)
  );
  const sellerInfo    = items[0]?.seller || null;
  const sellerId      = items[0]?.sellerId || null;

  // ── Actions ───────────────────────────────────────────────────

  /**
   * addItem — adds a product to the cart.
   * If the product is from a different seller, clears cart first.
   * Returns { replaced: bool } so UI can warn the buyer.
   */
  const addItem = useCallback((product, quantity = 1) => {
    const incomingSellerId = product.seller?._id || product.seller;
    let replaced = false;

    setItems((prev) => {
      // Different seller — reset cart
      if (prev.length > 0 && prev[0].sellerId !== incomingSellerId) {
        replaced = true;
        prev = [];
      }

      const existing = prev.find((i) => i._id === product._id);
      if (existing) {
        // Increase quantity, capped at stock
        return prev.map((i) =>
          i._id === product._id
            ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) }
            : i
        );
      }

      // New item
      return [
        ...prev,
        {
          _id:      product._id,
          title:    product.title,
          price:    product.price,
          image:    product.images?.[0] || product.image || '',
          stock:    product.stock,
          seller:   product.seller,
          sellerId: incomingSellerId,
          quantity: Math.min(quantity, product.stock),
        },
      ];
    });

    return { replaced };
  }, []);

  /** Remove one product entirely */
  const removeItem = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i._id !== productId));
  }, []);

  /** Set exact quantity — removes item if qty reaches 0 */
  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity < 1) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i._id === productId
          ? { ...i, quantity: Math.min(quantity, i.stock) }
          : i
      )
    );
  }, [removeItem]);

  /** Empty the cart */
  const clearCart = useCallback(() => setItems([]), []);

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalAmount,
        sellerInfo,
        sellerId,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
};
