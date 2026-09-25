"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, Tag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

export function CartDrawer() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const {
    items,
    isOpen,
    closeCart,
    removeFromCart,
    updateQuantity,
    subtotal,
    discount,
    shipping,
    total,
    voucherCode,
    applyVoucher,
  } = useCart();

  const [inputCode, setInputCode] = useState("");
  const [voucherMsg, setVoucherMsg] = useState<{ text: string; isError: boolean } | null>(null);

  if (!isOpen) return null;

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(p);
  };

  const handleApplyVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    const res = applyVoucher(inputCode);
    setVoucherMsg({ text: res.message, isError: !res.success });
  };

  const handleProceedToCheckout = () => {
    closeCart();
    if (!isAuthenticated) {
      router.push("/login?redirect=/checkout");
      return;
    }
    router.push("/checkout");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Dark overlay backdrop */}
      <div
        onClick={closeCart}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-slate-900 text-lg">Giỏ Hàng Công Nghệ</h2>
              <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                {items.length} món
              </span>
            </div>
            <button
              onClick={closeCart}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-4">
                  <ShoppingBag className="w-8 h-8 stroke-[1.5]" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">Giỏ hàng của bạn đang trống</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Chưa có thiết bị công nghệ nào được thêm. Hãy khám phá ngay các sản phẩm mới nhất!
                </p>
                <button
                  onClick={closeCart}
                  className="mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                >
                  Khám phá sản phẩm
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.variantId} className="py-4 flex gap-4 first:pt-0 last:pb-0">
                  {/* Thumbnail */}
                  <img
                    src={item.image}
                    alt={item.productName}
                    className="w-18 h-18 rounded-xl object-cover bg-slate-50 border border-slate-100 shrink-0"
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/products/${item.productSlug}`}
                          onClick={closeCart}
                          className="text-xs font-semibold text-slate-900 hover:text-indigo-600 line-clamp-1"
                        >
                          {item.productName}
                        </Link>
                        <button
                          onClick={() => removeFromCart(item.variantId)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                          aria-label="Xóa sản phẩm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.variantName}</p>
                      <div className="text-xs font-bold text-indigo-600 mt-1">
                        {formatPrice(item.price)}
                      </div>
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          className="p-1 px-2 text-slate-500 hover:bg-slate-200 transition-colors"
                          aria-label="Giảm"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-semibold text-slate-800 min-w-[24px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          disabled={item.quantity >= item.maxStock}
                          className="p-1 px-2 text-slate-500 hover:bg-slate-200 disabled:opacity-30 transition-colors"
                          aria-label="Tăng"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs font-semibold text-slate-700">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Summary */}
          {items.length > 0 && (
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-4">
              {/* Voucher Input */}
              <form onSubmit={handleApplyVoucher} className="space-y-1.5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value)}
                      placeholder="Mã voucher (thử: NOVATECH10)"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 uppercase font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
                  >
                    Áp dụng
                  </button>
                </div>
                {voucherMsg && (
                  <p
                    className={`text-[11px] ${
                      voucherMsg.isError ? "text-rose-500" : "text-emerald-600 font-medium"
                    }`}
                  >
                    {voucherMsg.text}
                  </p>
                )}
                {voucherCode && (
                  <div className="flex items-center justify-between text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    <span>Mã đã dùng: <b>{voucherCode}</b></span>
                    <span>Đã giảm {formatPrice(discount)}</span>
                  </div>
                )}
              </form>

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200/60">
                <div className="flex justify-between">
                  <span>Tạm tính:</span>
                  <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Giảm giá khuyến mãi:</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Phí vận chuyển:</span>
                  <span className="font-semibold text-slate-800">
                    {shipping === 0 ? "Miễn phí" : formatPrice(shipping)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Tổng thanh toán:</span>
                  <span className="text-base text-indigo-600">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Trust Badge */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Bảo hành chính hãng 24 tháng & Đổi mới trong 30 ngày</span>
              </div>

              {/* Checkout Action Button */}
              <button
                onClick={handleProceedToCheckout}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all"
              >
                <span>Tiến hành đặt hàng</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
