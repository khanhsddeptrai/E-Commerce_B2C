"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShoppingBag,
  RotateCcw,
  ShieldCheck,
  CreditCard,
  Loader2,
} from "lucide-react";
import { paymentService, VerifyPaymentResult } from "@/services/paymentService";

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyPaymentResult | null>(null);
  const hasVerifiedRef = React.useRef(false);

  useEffect(() => {
    const queryString = searchParams.toString();
    if (!queryString) {
      setLoading(false);
      return;
    }

    if (hasVerifiedRef.current) {
      return;
    }
    hasVerifiedRef.current = true;

    async function verify() {
      const data = await paymentService.verifyPaymentReturn(queryString);
      setResult(data);
      setLoading(false);
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem("novatech_pending_vnpay_orders");
          if (saved) {
            const list: { orderCode: string }[] = JSON.parse(saved);
            const remaining = list.filter((item) => item.orderCode !== data.order_code);
            if (remaining.length > 0) {
              localStorage.setItem("novatech_pending_vnpay_orders", JSON.stringify(remaining));
            } else {
              localStorage.removeItem("novatech_pending_vnpay_orders");
            }
          }
        } catch {
          // ignore
        }
        localStorage.removeItem("novatech_pending_vnpay_order");
      }
    }

    void verify();
  }, [searchParams]);

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(p);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 animate-spin">
          <Loader2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Đang đối soát giao dịch VNPAY...</h2>
        <p className="text-sm text-slate-500 max-w-md text-center">
          Vui lòng đợi giây lát trong khi hệ thống xác thực chữ ký số và cập nhật trạng thái đơn hàng.
        </p>
      </div>
    );
  }

  if (!result || !result.is_valid) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl border border-rose-100 p-8 text-center shadow-xl shadow-rose-500/5 space-y-6">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
          <AlertTriangle className="w-10 h-10" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Không Thể Xác Thực Giao Dịch</h1>
          <p className="text-sm text-slate-500 mt-2">
            {result?.message || "Không tìm thấy dữ liệu giao dịch hoặc chữ ký phản hồi không hợp lệ."}
          </p>
        </div>

        <div className="pt-4 flex justify-center gap-3">
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-600/20"
          >
            <RotateCcw className="w-4 h-4" /> Quay lại giỏ hàng
          </Link>
        </div>
      </div>
    );
  }

  const isSuccess = result.is_success;

  return (
    <div className="max-w-2xl mx-auto my-12 px-4">
      <div
        className={`bg-white rounded-3xl border p-8 text-center shadow-xl space-y-6 transition-all ${
          isSuccess
            ? "border-emerald-200/80 shadow-emerald-500/5"
            : "border-amber-200/80 shadow-amber-500/5"
        }`}
      >
        {/* Status Icon */}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-sm ${
            isSuccess ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
          }`}
        >
          {isSuccess ? <CheckCircle2 className="w-12 h-12" /> : <XCircle className="w-12 h-12" />}
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isSuccess ? "Thanh Toán Thành Công!" : "Thanh Toán Không Thành Công"}
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {isSuccess
              ? "Cảm ơn bạn đã mua sắm tại NovaTech. Đơn hàng của bạn đã được thanh toán và chuyển sang khâu xử lý đóng gói."
              : result.message || "Giao dịch bị hủy hoặc không thành công. Hệ thống đã giải phóng giữ kho cho đơn hàng."}
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-slate-50 rounded-2xl p-6 text-sm text-left space-y-3.5 border border-slate-100">
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500">Mã đơn hàng</span>
            <span className="font-bold text-indigo-600 font-mono text-base">{result.order_code}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500">Số tiền giao dịch</span>
            <span className="font-bold text-slate-900 text-base">{formatPrice(result.amount)}</span>
          </div>

          {result.transaction_no && (
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Mã GD VNPAY</span>
              <span className="font-mono text-slate-700 font-semibold">{result.transaction_no}</span>
            </div>
          )}

          {result.bank_code && (
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Ngân hàng thanh toán</span>
              <span className="font-semibold text-slate-700">{result.bank_code}</span>
            </div>
          )}

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500">Phương thức</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
              <CreditCard className="w-3.5 h-3.5" /> VNPAY Sandbox (NCB)
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
          {isSuccess ? (
            <>
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-600/25"
              >
                <ShoppingBag className="w-4 h-4" /> Tiếp tục mua sắm
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/checkout"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-600/25"
              >
                <RotateCcw className="w-4 h-4" /> Đặt hàng lại
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all"
              >
                Xem sản phẩm khác <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Bảo mật thanh toán & đối soát tự động bởi NovaTech SAGA Engine
        </div>
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}
