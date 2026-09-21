const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8000/api/v1";

export interface CreatePaymentUrlPayload {
  order_id: string;
  order_code: string;
  amount: number;
  payment_method?: string;
  bank_code?: string;
  return_url?: string;
}

export interface CreatePaymentUrlResult {
  success: boolean;
  payment_url?: string;
  payment_id?: string;
  message: string;
}

export interface VerifyPaymentResult {
  is_valid: boolean;
  is_success: boolean;
  order_code: string;
  amount: number;
  transaction_no: string;
  bank_code: string;
  message: string;
  response_code: string;
}

export const paymentService = {
  async createPaymentUrl(payload: CreatePaymentUrlPayload): Promise<CreatePaymentUrlResult> {
    try {
      const res = await fetch(`${API_BASE_URL}/payments/create-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as CreatePaymentUrlResult;
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi kết nối máy chủ thanh toán";
      return { success: false, message: msg };
    }
  },

  async verifyPaymentReturn(queryString: string): Promise<VerifyPaymentResult> {
    try {
      const res = await fetch(`${API_BASE_URL}/payments/vnpay-return?${queryString}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as VerifyPaymentResult;
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi xác thực giao dịch";
      return {
        is_valid: false,
        is_success: false,
        order_code: "",
        amount: 0,
        transaction_no: "",
        bank_code: "",
        message: msg,
        response_code: "99",
      };
    }
  },
};
