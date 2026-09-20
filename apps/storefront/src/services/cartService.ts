import { ApiCartDto, Product, ProductVariant } from "@/types/ecommerce";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8000/api/v1";

function getCartSessionId(): string {
  if (typeof window === "undefined") return "server_session";
  let sessionId = localStorage.getItem("nova_cart_session_id");
  if (!sessionId) {
    sessionId = "guest_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("nova_cart_session_id", sessionId);
  }
  return sessionId;
}

export const cartService = {
  async getCart(): Promise<ApiCartDto | null> {
    try {
      const sessionId = getCartSessionId();
      const res = await fetch(`${API_BASE_URL}/cart`, {
        headers: {
          "x-cart-session-id": sessionId,
        },
        cache: "no-store",
      });

      if (res.ok) {
        return (await res.json()) as ApiCartDto;
      }
    } catch (err: unknown) {
      console.warn("[cartService.getCart] Error fetching cart:", err);
    }
    return null;
  },

  async addItem(product: Product, variant: ProductVariant, quantity = 1): Promise<ApiCartDto | null> {
    try {
      const sessionId = getCartSessionId();
      const res = await fetch(`${API_BASE_URL}/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cart-session-id": sessionId,
        },
        body: JSON.stringify({
          sku_id: variant.id,
          quantity,
          product_id: product.id,
          product_name: product.name,
          product_slug: product.slug,
          variant_name: variant.name,
          color_name: variant.colorName,
          price: variant.price,
          original_price: variant.originalPrice,
          image: variant.image || product.images[0],
          max_stock: variant.stock,
        }),
      });

      if (res.ok) {
        return (await res.json()) as ApiCartDto;
      }
    } catch (err: unknown) {
      console.warn("[cartService.addItem] Error adding to cart:", err);
    }
    return null;
  },

  async updateQuantity(skuId: string, quantity: number): Promise<ApiCartDto | null> {
    try {
      const sessionId = getCartSessionId();
      const res = await fetch(`${API_BASE_URL}/cart/items/${encodeURIComponent(skuId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-cart-session-id": sessionId,
        },
        body: JSON.stringify({ quantity }),
      });

      if (res.ok) {
        return (await res.json()) as ApiCartDto;
      }
    } catch (err: unknown) {
      console.warn("[cartService.updateQuantity] Error updating quantity:", err);
    }
    return null;
  },

  async removeItem(skuId: string): Promise<ApiCartDto | null> {
    try {
      const sessionId = getCartSessionId();
      const res = await fetch(`${API_BASE_URL}/cart/items/${encodeURIComponent(skuId)}`, {
        method: "DELETE",
        headers: {
          "x-cart-session-id": sessionId,
        },
      });

      if (res.ok) {
        return (await res.json()) as ApiCartDto;
      }
    } catch (err: unknown) {
      console.warn("[cartService.removeItem] Error removing item:", err);
    }
    return null;
  },

  async clearCart(): Promise<boolean> {
    try {
      const sessionId = getCartSessionId();
      const res = await fetch(`${API_BASE_URL}/cart`, {
        method: "DELETE",
        headers: {
          "x-cart-session-id": sessionId,
        },
      });
      return res.ok;
    } catch (err: unknown) {
      console.warn("[cartService.clearCart] Error clearing cart:", err);
    }
    return false;
  },
};
