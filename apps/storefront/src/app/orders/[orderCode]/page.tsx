'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  ShoppingBag,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ExternalLink,
  RotateCcw,
  Loader2,
  Calendar,
  CreditCard,
  User,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import { orderService } from '@/services/orderService';
import { ApiOrderDto } from '@/types/ecommerce';

interface PageProps {
  params: Promise<{
    orderCode: string;
  }>;
}

export default function OrderDetailsPage({ params }: PageProps) {
  const router = useRouter();
  const { orderCode } = use(params);

  const [order, setOrder] = useState<ApiOrderDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!orderCode) return;
    setIsLoading(true);
    orderService
      .getOrderById(orderCode)
      .then((data) => {
        if (data) {
          setOrder(data);
        } else {
          setErrorMessage('Không tìm thấy đơn hàng với mã: ' + orderCode);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Lỗi nạp thông tin đơn hàng';
        setErrorMessage(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [orderCode]);

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    const confirm = window.confirm('Bạn có chắc chắn muốn hủy đơn hàng này không?');
    if (!confirm) return;

    setIsCancelling(true);
    try {
      const res = await orderService.cancelOrder(order.id, 'Khách hàng yêu cầu hủy từ trang chi tiết');
      if (res.success) {
        setOrder({
          ...order,
          order_status: 'CANCELLED',
          cancel_reason: 'Khách hàng yêu cầu hủy từ trang chi tiết',
        });
      } else {
        alert(res.message || 'Không thể hủy đơn hàng này');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối khi hủy đơn';
      alert(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  // Tính bước hiện tại trong tiến trình vận chuyển
  const getTimelineStep = (orderStatus: string, paymentStatus: string) => {
    if (orderStatus === 'CANCELLED') return -1;
    if (orderStatus === 'DELIVERED') return 5;
    if (orderStatus === 'SHIPPING') return 4;
    if (orderStatus === 'PROCESSING') return 3;
    if (orderStatus === 'CONFIRMED' || paymentStatus === 'PAID') return 2;
    return 1; // PENDING
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 animate-spin">
          <Loader2 className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Đang tra cứu đơn hàng {orderCode}...</h2>
      </div>
    );
  }

  if (errorMessage || !order) {
    return (
      <div className="max-w-xl mx-auto my-16 bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-xl space-y-5">
        <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900">Không Tìm Thấy Đơn Hàng</h1>
          <p className="text-xs text-slate-500">{errorMessage || 'Mã đơn hàng không tồn tại hoặc đã bị xóa.'}</p>
        </div>
        <div className="pt-2 flex justify-center gap-3">
          <Link
            href="/account/orders"
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Đơn hàng của tôi
          </Link>
          <Link
            href="/products"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-md shadow-indigo-600/20"
          >
            Xem sản phẩm khác
          </Link>
        </div>
      </div>
    );
  }

  const currentStep = getTimelineStep(order.order_status, order.payment_status);

  // Phân tích shipping address json
  let shippingParsed: { address?: string; district?: string; city?: string; fullAddress?: string } = {};
  try {
    shippingParsed = JSON.parse(order.shipping_address_json);
  } catch {
    shippingParsed = { fullAddress: order.shipping_address_json };
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Return breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách đơn hàng
        </Link>
        <span className="text-xs text-slate-400">
          Ngày đặt: <span className="font-semibold text-slate-700">{formatDate(order.created_at)}</span>
        </span>
      </div>

      {/* Main Order Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Mã đơn hàng</span>
              <span className="font-mono font-extrabold text-indigo-600 text-lg sm:text-xl">
                {order.order_code}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Phương thức thanh toán:{' '}
              <span className="font-bold text-slate-800">{order.payment_method}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {order.order_status === 'CANCELLED' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <XCircle className="w-4 h-4" /> Đã hủy đơn hàng
              </span>
            ) : order.order_status === 'DELIVERED' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" /> Giao hàng thành công
              </span>
            ) : order.order_status === 'SHIPPING' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Truck className="w-4 h-4 animate-pulse" /> Đang vận chuyển
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <CheckCircle2 className="w-4 h-4" /> Đã xác nhận đơn
              </span>
            )}
          </div>
        </div>

        {/* CANCELLATION NOTICE IF CANCELLED */}
        {order.order_status === 'CANCELLED' && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-rose-900">Đơn hàng này đã bị hủy</p>
              <p className="text-rose-700">
                Lý do: {order.cancel_reason || 'Khách hàng yêu cầu hủy đơn hoặc quá thời hạn thanh toán 15 phút.'}
              </p>
              <p className="text-rose-600 text-[11px]">
                Toàn bộ số lượng sản phẩm giữ kho đã được giải phóng trở lại kho hàng tự động bởi hệ thống SAGA.
              </p>
            </div>
          </div>
        )}

        {/* ORDER TRACKING TIMELINE UI */}
        {order.order_status !== 'CANCELLED' && (
          <div className="pt-2 pb-4 space-y-6">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" />
              Tiến Trình Đơn Hàng
            </h2>

            {/* Desktop Stepper */}
            <div className="relative">
              <div className="hidden sm:grid grid-cols-5 gap-2 text-center relative z-10">
                {[
                  { step: 1, title: 'Đã Đặt Hàng', desc: 'Chờ thanh toán / xác nhận' },
                  { step: 2, title: 'Đã Xác Nhận', desc: 'Đã thanh toán thành công' },
                  { step: 3, title: 'Đang Đóng Gói', desc: 'Kiểm tra & xuất kho' },
                  { step: 4, title: 'Đang Giao Hàng', desc: 'Shipper đang trên đường giao' },
                  { step: 5, title: 'Giao Thành Công', desc: 'Đã nhận kiện hàng' },
                ].map((s) => {
                  const isDone = currentStep >= s.step;
                  const isCurrent = currentStep === s.step;
                  return (
                    <div key={s.step} className="flex flex-col items-center space-y-2">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                          isDone
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        } ${isCurrent ? 'ring-4 ring-indigo-500/20 scale-105' : ''}`}
                      >
                        {isDone ? <CheckCircle2 className="w-5 h-5" /> : s.step}
                      </div>
                      <div className="space-y-0.5">
                        <p
                          className={`text-xs font-bold ${
                            isDone ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {s.title}
                        </p>
                        <p className="text-[10px] text-slate-500 leading-tight">{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Connecting line */}
              <div className="hidden sm:block absolute top-4 left-[10%] right-[10%] h-0.5 bg-slate-200 -z-0">
                <div
                  className="h-full bg-indigo-600 transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, ((currentStep - 1) / 4) * 100))}%`,
                  }}
                />
              </div>

              {/* Mobile Timeline Vertical */}
              <div className="sm:hidden space-y-4 pl-4 border-l-2 border-indigo-600/30 ml-2">
                {[
                  { step: 1, title: 'Đã Đặt Hàng', desc: 'Chờ thanh toán / xác nhận' },
                  { step: 2, title: 'Đã Xác Nhận', desc: 'Đã thanh toán thành công' },
                  { step: 3, title: 'Đang Đóng Gói', desc: 'Kiểm tra & xuất kho' },
                  { step: 4, title: 'Đang Giao Hàng', desc: 'Shipper đang trên đường giao' },
                  { step: 5, title: 'Giao Thành Công', desc: 'Đã nhận kiện hàng' },
                ].map((s) => {
                  const isDone = currentStep >= s.step;
                  return (
                    <div key={s.step} className="flex items-start gap-3">
                      <div
                        className={`w-6 h-6 -ml-[25px] rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isDone ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {s.step}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                          {s.title}
                        </p>
                        <p className="text-[11px] text-slate-500">{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Details & Shipping Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Products & Summary (Col 8) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Items card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600" />
              Sản Phẩm Trong Đơn ({order.items?.length || 0})
            </h2>

            <div className="divide-y divide-slate-100">
              {order.items &&
                order.items.map((item) => (
                  <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt={item.product_name}
                          className="w-14 h-14 rounded-2xl object-cover bg-slate-100 shrink-0 border border-slate-100"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.product_name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Biến thể: <span className="font-semibold text-slate-700">{item.sku_name}</span>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatPrice(item.unit_price)} × {item.quantity}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-900">
                        {formatPrice(item.total_price || item.unit_price * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Calculations */}
            <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Tạm tính hàng hóa:</span>
                <span className="font-semibold text-slate-900">{formatPrice(order.subtotal_amount)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Voucher giảm giá {order.voucher_code ? `(${order.voucher_code})` : ''}:</span>
                  <span>-{formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Phí vận chuyển:</span>
                <span className="font-semibold text-slate-900">
                  {order.shipping_fee === 0 ? 'Miễn phí' : formatPrice(order.shipping_fee)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Tổng giá trị đơn hàng:</span>
                <span className="text-base text-indigo-600 font-extrabold">{formatPrice(order.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {order.order_status === 'CONFIRMED' && (
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="px-4 py-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Hủy Đơn Hàng Này
              </button>
            )}

            <Link
              href="/products"
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" /> Mua Thêm Thiết Bị Khác
            </Link>
          </div>
        </div>

        {/* Right: Shipping & Customer Details (Col 4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Shipping Info Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4 text-xs">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              Thông Tin Nhận Hàng
            </h2>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-slate-700">
                <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="font-semibold text-slate-900">{order.customer_name}</span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-700">
                <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{order.customer_phone}</span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-700">
                <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{order.customer_email}</span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-700 pt-1 border-t border-slate-100">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{shippingParsed.fullAddress || shippingParsed.address || order.shipping_address_json}</span>
              </div>
              {order.note && (
                <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 border border-slate-100">
                  <span className="font-bold text-slate-700">Ghi chú:</span> {order.note}
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4 text-xs">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              Trạng Thái Thanh Toán
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Hình thức:</span>
                <span className="font-bold text-slate-800">{order.payment_method}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tình trạng:</span>
                <span
                  className={`font-bold ${
                    order.payment_status === 'PAID'
                      ? 'text-emerald-600'
                      : order.payment_status === 'FAILED'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                  }`}
                >
                  {order.payment_status === 'PAID'
                    ? 'Đã Thanh Toán'
                    : order.payment_status === 'FAILED'
                      ? 'Thất Bại'
                      : 'Chưa Thanh Toán'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-400 border-t border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Giao dịch bảo mật cấp doanh nghiệp NovaTech</span>
            </div>
          </div>

          {/* Need Support Card */}
          <div className="bg-gradient-to-br from-indigo-50/60 to-violet-50/60 rounded-3xl border border-indigo-100 p-6 text-xs space-y-3">
            <h3 className="font-bold text-indigo-950 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" /> Cần Hỗ Trợ Đơn Hàng?
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Nếu bạn cần thay đổi địa chỉ giao hàng hoặc kiểm tra tiến độ gấp, vui lòng liên hệ tổng đài 24/7 của chúng tôi.
            </p>
            <p className="font-bold text-indigo-600">Hotline: 1900 8888 (Miễn phí cước)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
