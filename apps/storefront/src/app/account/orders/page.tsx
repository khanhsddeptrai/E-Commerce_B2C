'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  ShoppingBag,
  ArrowRight,
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { orderService } from '@/services/orderService';
import { ApiOrderDto } from '@/types/ecommerce';

export default function AccountOrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [orders, setOrders] = useState<ApiOrderDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setIsLoading(false);
      return;
    }

    if (user?.id) {
      setIsLoading(true);
      orderService
        .getOrdersByCustomer(user.id, 1, 50)
        .then((res) => {
          setOrders(res.orders || []);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [user?.id, isAuthenticated, authLoading]);

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

  const getStatusBadge = (orderStatus: string, paymentStatus: string) => {
    if (orderStatus === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3.5 h-3.5" /> Đã hủy
        </span>
      );
    }
    if (orderStatus === 'DELIVERED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> Giao thành công
        </span>
      );
    }
    if (orderStatus === 'SHIPPING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Truck className="w-3.5 h-3.5 animate-pulse" /> Đang giao hàng
        </span>
      );
    }
    if (orderStatus === 'CONFIRMED' || paymentStatus === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> Đã xác nhận / Đã thanh toán
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3.5 h-3.5 animate-pulse" /> Chờ thanh toán
      </span>
    );
  };

  // Lọc theo trạng thái tab
  const filteredOrders = orders.filter((o) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'PENDING') return o.order_status === 'PENDING';
    if (activeFilter === 'CONFIRMED') return o.order_status === 'CONFIRMED';
    if (activeFilter === 'SHIPPING') return o.order_status === 'SHIPPING';
    if (activeFilter === 'DELIVERED') return o.order_status === 'DELIVERED';
    if (activeFilter === 'CANCELLED') return o.order_status === 'CANCELLED';
    return true;
  });

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-xs text-slate-500">Đang kiểm tra thông tin tài khoản...</p>
      </div>
    );
  }

  // Chưa đăng nhập
  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200/80 shadow-xl text-center space-y-5 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <User className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Yêu Cầu Đăng Nhập</h2>
          <p className="text-xs text-slate-500">
            Vui lòng đăng nhập tài khoản để tra cứu lịch sử và quản lý các đơn hàng của bạn.
          </p>
        </div>
        <Link
          href="/login?redirect=/account/orders"
          className="inline-flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20"
        >
          Đăng Nhập Ngay <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-2">
            <Package className="w-3.5 h-3.5" /> Quản lý đơn hàng
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Đơn Hàng Của Tôi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Xin chào <span className="font-semibold text-slate-800">{user.fullName}</span>, bạn có tổng cộng{' '}
            <span className="font-bold text-indigo-600">{orders.length}</span> đơn hàng đã đặt.
          </p>
        </div>

        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors self-start sm:self-auto"
        >
          <ShoppingBag className="w-4 h-4" /> Tiếp tục mua sắm
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs font-semibold">
        {[
          { key: 'ALL', label: 'Tất cả đơn' },
          { key: 'PENDING', label: 'Chờ thanh toán' },
          { key: 'CONFIRMED', label: 'Đã xác nhận' },
          { key: 'SHIPPING', label: 'Đang giao' },
          { key: 'DELIVERED', label: 'Đã nhận hàng' },
          { key: 'CANCELLED', label: 'Đã hủy' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
              activeFilter === tab.key
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs text-slate-500">Đang tải danh sách đơn hàng...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 bg-white rounded-3xl border border-slate-200/80 text-center p-8 space-y-4">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Không tìm thấy đơn hàng nào</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeFilter === 'ALL'
              ? 'Bạn chưa có đơn hàng nào tại NovaTech. Khám phá các thiết bị flagship công nghệ ngay hôm nay!'
              : 'Không có đơn hàng nào phù hợp với bộ lọc trạng thái này.'}
          </p>
          <Link
            href="/products"
            className="inline-block px-5 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20"
          >
            Khám Phá Sản Phẩm
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow space-y-4"
            >
              {/* Order Meta Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-indigo-600 text-sm">
                    {order.order_code}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(order.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(order.order_status, order.payment_status)}
                </div>
              </div>

              {/* Items List */}
              <div className="divide-y divide-slate-100">
                {order.items &&
                  order.items.map((item) => (
                    <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt={item.product_name}
                            className="w-12 h-12 rounded-xl object-cover bg-slate-100 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{item.product_name}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {item.sku_name} • Số lượng: <span className="font-bold text-slate-700">{item.quantity}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-900">
                          {formatPrice(item.unit_price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Order Footer & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Hình thức: <span className="font-semibold text-slate-800">{order.payment_method}</span>
                  </span>
                  <span>•</span>
                  <span>
                    Tổng thanh toán:{' '}
                    <span className="font-extrabold text-indigo-600 text-sm">{formatPrice(order.total_amount)}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Link
                    href={`/orders/${order.order_code}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Xem Chi Tiết & Tiến Trình <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
