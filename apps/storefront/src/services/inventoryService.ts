import {
  AdjustStockPayload,
  AdjustStockResult,
  ApiInventoryStockItemDto,
  ApiInventoryTransactionDto,
  ApiReceiptDto,
  CreateReceiptPayload,
  InventoryStocksQuery,
  InventoryTransactionsQuery,
  PaginatedResponse,
  ReceiptsQuery,
  ReconcileStockResult,
} from "@/types/ecommerce";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8000/api/v1";
const INVENTORY_BASE_URL = `${API_BASE_URL}/admin/inventory`;

interface ApiErrorBody {
  message?: string | string[];
}

function buildQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, unknown][]) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Gọi API kho; lỗi HTTP được ném ra dưới dạng Error kèm thông điệp từ backend để giao diện hiển thị */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${INVENTORY_BASE_URL}${path}`, {
      cache: "no-store",
      credentials: "include",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (err: unknown) {
    throw new Error(err instanceof Error ? `Lỗi kết nối máy chủ: ${err.message}` : "Lỗi kết nối máy chủ");
  }

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const body = (data ?? {}) as ApiErrorBody;
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message || `Yêu cầu thất bại (HTTP ${res.status})`);
  }
  return data as T;
}

export const inventoryService = {
  getStocks(query: InventoryStocksQuery = {}): Promise<PaginatedResponse<ApiInventoryStockItemDto>> {
    return request(`/stocks${buildQuery(query)}`);
  },

  getTransactions(query: InventoryTransactionsQuery = {}): Promise<PaginatedResponse<ApiInventoryTransactionDto>> {
    return request(`/transactions${buildQuery(query)}`);
  },

  getReceipts(query: ReceiptsQuery = {}): Promise<PaginatedResponse<ApiReceiptDto>> {
    return request(`/receipts${buildQuery(query)}`);
  },

  createReceipt(payload: CreateReceiptPayload): Promise<ApiReceiptDto> {
    return request("/receipts", { method: "POST", body: JSON.stringify(payload) });
  },

  adjustStock(payload: AdjustStockPayload): Promise<AdjustStockResult> {
    return request("/adjustments", { method: "POST", body: JSON.stringify(payload) });
  },

  reconcile(): Promise<ReconcileStockResult> {
    return request("/reconcile", { method: "POST" });
  },
};
