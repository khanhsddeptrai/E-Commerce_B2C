"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  CreditCard,
  QrCode,
  Truck,
  Wallet,
  ShoppingBag,
} from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, discount, shipping, total, clearCart, voucherCode } = useCart();

  const [paymentMethod, setPaymentMethod] = useState<"vnpay" | "momo" | "card" | "cod">("vnpay");
  const [formData, setFormData] = useState({
    fullName: "Nguyễn Văn An",
    phone: "0901234567",
    email: "an.nguyen@example.com",
    city: "Hồ Chí Minh",
    district: "Quận 1",
    address: "Số 123 Đường Lê Lợi, Phường Bến Nghé",
    note: "Giao trong giờ hành chính giúp tôi.",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{
    orderId: string;
    total: number;
  } | null>(null);

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(p);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setIsSubmitting(true);
    // Simulate Order Service & Payment SAGA
    setTimeout(() => {
      const generatedOrderId = `NV-${Math.floor(100000 + Math.random() * 900000)}`;
      setOrderSuccess({
        orderId: generatedOrderId,
        total: total,
      });
      clearCart();
      setIsSubmitting(false);
    }, 1200);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Return link */}
      <div className="mb-6">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Tiếp tục xem sản phẩm
        </Link>
      </div>

      {orderSuccess ? (
        /* ORDER SUCCESS MODAL / SCREEN */
        <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200/80 p-8 text-center shadow-xl space-y-6 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">Đặt Hàng Thành Công!</h1>
            <p className="text-xs text-slate-500 mt-1">
              Cảm ơn bạn đã tin chọn hệ sinh thái thiết bị thông minh NovaTech.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 text-xs text-left space-y-2 border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Mã đơn hàng:</span>
              <span className="font-bold text-indigo-600 font-mono text-sm">
                {orderSuccess.orderId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Người nhận:</span>
              <span className="font-semibold text-slate-800">{formData.fullName} ({formData.phone})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Địa chỉ giao:</span>
              <span className="font-semibold text-slate-800 text-right">
                {formData.address}, {formData.district}, {formData.city}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Phương thức:</span>
              <span className="font-semibold text-slate-800 uppercase">{paymentMethod}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
              <span>Tổng số tiền:</span>
              <span className="text-indigo-600">{formatPrice(orderSuccess.total)}</span>
            </div>
          </div>

          <div className="p-3 bg-indigo-50/60 rounded-xl text-[11px] text-indigo-700">
            Đơn hàng đã được ghi nhận vào hệ thống phân tán và điều phối tới trung tâm hoàn tất đơn gần nhất. Thông tin chi tiết đã được gửi tới email <b>{formData.email}</b>.
          </div>

          <button
            onClick={() => router.push("/")}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-md shadow-indigo-600/20"
          >
            Quay Về Trang Chủ
          </button>
        </div>
      ) : items.length === 0 ? (
        /* EMPTY CART REDIRECT */
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 max-w-md mx-auto p-8 space-y-4">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Giỏ hàng của bạn đang trống</h2>
          <p className="text-xs text-slate-500">Vui lòng chọn ít nhất một sản phẩm để tiến hành đặt hàng.</p>
          <Link
            href="/products"
            className="inline-block px-5 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl"
          >
            Khám Phá Sản Phẩm
          </Link>
        </div>
      ) : (
        /* CHECKOUT FORM & SUMMARY */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form (Col 7) */}
          <div className="lg:col-span-7 space-y-6">
            <form onSubmit={handleSubmitOrder} id="checkout-form" className="space-y-6">
              {/* Shipping Address Section */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  1. Thông Tin Nhận Hàng
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Họ và tên *</label>
                    <input
                      type="text"
                      name="fullName"
                      required
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Số điện thoại *</label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="font-bold text-slate-700 block mb-1">Email nhận thông báo *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Tỉnh / Thành phố *</label>
                    <input
                      type="text"
                      name="city"
                      required
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Quận / Huyện *</label>
                    <input
                      type="text"
                      name="district"
                      required
                      value={formData.district}
                      onChange={handleInputChange}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="font-bold text-slate-700 block mb-1">Địa chỉ cụ thể *</label>
                  <input
                    type="text"
                    name="address"
                    required
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="text-xs">
                  <label className="font-bold text-slate-700 block mb-1">Ghi chú giao hàng</label>
                  <textarea
                    name="note"
                    rows={2}
                    value={formData.note}
                    onChange={handleInputChange}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Payment Methods Section */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-indigo-600" />
                  2. Phương Thức Thanh Toán
                </h2>

                <div className="space-y-2.5 text-xs">
                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "vnpay"
                        ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "vnpay"}
                      onChange={() => setPaymentMethod("vnpay")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <QrCode className="w-5 h-5 text-indigo-600 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">VNPAY QR (Khuyên dùng)</div>
                      <div className="text-[11px] text-slate-500">Quét mã QR qua tất cả ứng dụng ngân hàng</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "momo"
                        ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "momo"}
                      onChange={() => setPaymentMethod("momo")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <Wallet className="w-5 h-5 text-pink-600 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">Ví điện tử MoMo</div>
                      <div className="text-[11px] text-slate-500">Thanh toán tức thời qua ứng dụng MoMo</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "card"
                        ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "card"}
                      onChange={() => setPaymentMethod("card")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <CreditCard className="w-5 h-5 text-slate-700 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">Thẻ Visa / Mastercard</div>
                      <div className="text-[11px] text-slate-500">Thanh toán an toàn qua cổng mã hóa SSL 256-bit</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "cod"
                        ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "cod"}
                      onChange={() => setPaymentMethod("cod")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <Truck className="w-5 h-5 text-slate-700 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">Thanh toán khi nhận hàng (COD)</div>
                      <div className="text-[11px] text-slate-500">Kiểm tra hàng trước khi thanh toán tiền mặt</div>
                    </div>
                  </label>
                </div>
              </div>
            </form>
          </div>

          {/* Right Order Summary (Col 5) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6 sticky top-24">
            <h2 className="text-base font-bold text-slate-900 flex items-center justify-between pb-3 border-b border-slate-100">
              <span>Đơn Hàng ({items.length} món)</span>
              <Link href="/products" className="text-xs font-semibold text-indigo-600 hover:underline">
                Sửa
              </Link>
            </h2>

            {/* Item list */}
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1 text-xs">
              {items.map((item) => (
                <div key={item.variantId} className="py-3 flex items-center gap-3 first:pt-0">
                  <img
                    src={item.image}
                    alt={item.productName}
                    className="w-12 h-12 rounded-lg object-cover bg-slate-50 border border-slate-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{item.productName}</p>
                    <p className="text-[11px] text-slate-400">
                      {item.variantName} x {item.quantity}
                    </p>
                  </div>
                  <div className="font-bold text-slate-900 shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* Calculations */}
            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Tạm tính:</span>
                <span className="font-semibold text-slate-900">{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Voucher giảm giá ({voucherCode}):</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Phí vận chuyển:</span>
                <span className="font-semibold text-slate-900">
                  {shipping === 0 ? "Miễn phí" : formatPrice(shipping)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-3 border-t border-slate-200">
                <span>Tổng cộng:</span>
                <span className="text-lg text-indigo-600">{formatPrice(total)}</span>
              </div>
            </div>

            {/* Trust badge */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Giao dịch bảo mật 100% qua chuẩn mã hóa thanh toán cấp doanh nghiệp.</span>
            </div>

            {/* Place Order Button */}
            <button
              type="submit"
              form="checkout-form"
              disabled={isSubmitting}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Đang kết nối cổng thanh toán...</span>
              ) : (
                <span>Xác Nhận Đặt Hàng — {formatPrice(total)}</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
