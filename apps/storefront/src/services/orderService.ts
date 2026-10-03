import { ApiOrderDto, CreateOrderPayload, StockSyncStatus } from "@/types/ecommerce";

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
        credentials: "include",
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
        credentials: "include",
      });
      if (res.ok) {
        return (await res.json()) as ApiOrderDto;
      }
    } catch (err: unknown) {
      console.warn("[orderService.getOrderById] Error:", err);
    }
    return null;
  },

  async getOrdersByCustomer(
    customerId: string,
    page = 1,
    limit = 10
  ): Promise<{ orders: ApiOrderDto[]; total: number }> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/orders/customer/${encodeURIComponent(customerId)}?page=${page}&limit=${limit}`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );
      if (res.ok) {
        const data = await res.json();
        return {
          orders: (data.orders || []) as ApiOrderDto[],
          total: Number(data.total || 0),
        };
      }
    } catch (err: unknown) {
      console.warn("[orderService.getOrdersByCustomer] Error:", err);
    }
    return { orders: [], total: 0 };
  },

  async cancelOrder(orderId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reason || "Khách hàng hủy để đặt lại" }),
      });
      const data = await res.json();
      return {
        success: Boolean(data.success),
        message: data.message || "",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi kết nối";
      return { success: false, message: msg };
    }
  },

  async updateDeliveryStatus(
    orderId: string,
    payload: {
      new_status: string;
      location?: string;
      note?: string;
      carrier_name?: string;
      tracking_code?: string;
      changed_by?: string;
    }
  ): Promise<{ success: boolean; message: string; order?: ApiOrderDto }> {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/delivery-status`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return {
        success: res.ok && Boolean(data.success),
        // Lỗi từ backend (vd 409 chuyển trạng thái không hợp lệ) trả về message dạng chuỗi hoặc mảng (lỗi validate)
        message: Array.isArray(data.message) ? data.message.join(", ") : data.message || "",
        order: data.order as ApiOrderDto | undefined,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi kết nối khi cập nhật vận chuyển";
      return { success: false, message: msg };
    }
  },

  /** Admin thử lại các thao tác kho đang chờ / thất bại của đơn */
  async retryStockSync(orderId: string): Promise<{
    success: boolean;
    message: string;
    stock_sync_status?: StockSyncStatus;
    stock_sync_error?: string;
  }> {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/retry-stock-sync`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      return {
        success: res.ok && Boolean(data.success),
        message: Array.isArray(data.message) ? data.message.join(", ") : data.message || "",
        stock_sync_status: data.stock_sync_status as StockSyncStatus | undefined,
        stock_sync_error: data.stock_sync_error as string | undefined,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi kết nối khi thử lại đồng bộ kho";
      return { success: false, message: msg };
    }
  },

  async getAllOrdersForAdmin(page = 1, limit = 20): Promise<{ orders: ApiOrderDto[]; total: number }> {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/admin/all?page=${page}&limit=${limit}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        return {
          orders: (data.orders || []) as ApiOrderDto[],
          total: Number(data.total || 0),
        };
      }
    } catch (err: unknown) {
      console.warn("[orderService.getAllOrdersForAdmin] Error:", err);
    }
    return { orders: [], total: 0 };
  },
};

