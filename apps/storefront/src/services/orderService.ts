import { ApiOrderDto, CreateOrderPayload } from "@/types/ecommerce";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8000/api/v1";

function getCartSessionId(): string {
  if (typeof window === "undefined") return "server_session";
  return localStorage.getItem("nova_cart_session_id") || "guest_default_session";
}

export const orderService = {
  async createOrder(payload: CreateOrderPayload): Promise<{ success: boolean; message: string; order?: ApiOrderDto }> {
    try {
      const sessionId = getCartSessionId();
      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cart-session-id": sessionId,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return {
          success: true,
          message: data.message || "Đặt hàng thành công",
          order: data.order as ApiOrderDto,
        };
      }

      return {
        success: false,
        message: data.message || "Không thể tạo đơn hàng, vui lòng thử lại",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi kết nối máy chủ";
      return {
        success: false,
        message: msg,
      };
    }
  },

  async getOrderById(orderId: string): Promise<ApiOrderDto | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        return (await res.json()) as ApiOrderDto;
      }
    } catch (err: unknown) {
      console.warn("[orderService.getOrderById] Error:", err);
    }
    return null;
  },
};
