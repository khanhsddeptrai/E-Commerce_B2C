"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { CartItem, Product, ProductVariant } from "@/types/ecommerce";

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: Product, variant: ProductVariant, quantity?: number) => void;
  removeFromCart: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  voucherCode: string;
  applyVoucher: (code: string) => { success: boolean; message: string };
  toastMessage: string | null;
  dismissToast: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nova_cart");
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("nova_cart", JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  }, [items]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  const addToCart = (product: Product, variant: ProductVariant, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.variantId === variant.id);
      if (existing) {
        return prev.map((item) =>
          item.variantId === variant.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, variant.stock) }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          variantId: variant.id,
          variantName: variant.name,
          colorName: variant.colorName,
          price: variant.price,
          originalPrice: variant.originalPrice,
          image: variant.image || product.images[0],
          quantity: Math.min(quantity, variant.stock),
          maxStock: variant.stock,
        },
      ];
    });

    showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
    setIsOpen(true);
  };

  const removeFromCart = (variantId: string) => {
    setItems((prev) => prev.filter((item) => item.variantId !== variantId));
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(variantId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.variantId === variantId
          ? { ...item, quantity: Math.min(quantity, item.maxStock) }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setVoucherCode("");
    setDiscountPercent(0);
  };

  const applyVoucher = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean === "NOVATECH10") {
      setVoucherCode(clean);
      setDiscountPercent(10);
      return { success: true, message: "Áp dụng mã NOVATECH10 thành công (-10%)!" };
    }
    if (clean === "FREESHIP") {
      setVoucherCode(clean);
      setDiscountPercent(5);
      return { success: true, message: "Áp dụng mã FREESHIP thành công!" };
    }
    return { success: false, message: "Mã giảm giá không hợp lệ hoặc đã hết hạn!" };
  };

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discount = Math.round((subtotal * discountPercent) / 100);
  const shipping = subtotal > 2000000 || subtotal === 0 ? 0 : 35000;
  const total = Math.max(0, subtotal - discount + shipping);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        openCart,
        closeCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        discount,
        shipping,
        total,
        voucherCode,
        applyVoucher,
        toastMessage,
        dismissToast: () => setToastMessage(null),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
