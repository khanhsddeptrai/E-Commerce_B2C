'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  Package,
  LogOut,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Layers,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { orderService } from '@/services/orderService';

export default function AccountProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [orderCount, setOrderCount] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/account/profile');
      return;
    }

    if (user?.id) {
      orderService
        .getOrdersByCustomer(user.id, 1, 1)
        .then((res) => {
          setOrderCount(res.total);
        })
        .catch(() => {
          setOrderCount(0);
        });
    }
  }, [user?.id, isAuthenticated, authLoading, router]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Mới tham gia gần đây';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-xs text-slate-500">Đang tải thông tin tài khoản...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Thông Tin Tài Khoản
        </h1>
      </div>

      {/* Main Profile Summary Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-slate-100">
          {/* Avatar with initials or photo */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-indigo-500/20">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[10px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* User main info */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-900">{user.fullName}</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                <Sparkles className="w-3 h-3" /> Thành Viên NovaTech
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Mã khách hàng: <span className="font-bold text-slate-700">{user.id.slice(0, 13)}...</span>
            </p>
            <p className="text-xs text-slate-400">
              Ngày gia nhập: <span className="font-semibold text-slate-600">{formatDate(user.createdAt)}</span>
            </p>
          </div>

          {/* Quick Order Stats Badge */}
          <div className="sm:text-right bg-slate-50 p-4 rounded-2xl border border-slate-100/80 w-full sm:w-auto">
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Tổng đơn hàng</p>
            <p className="text-2xl font-black text-indigo-600">
              {orderCount !== null ? orderCount : '...'}
            </p>
            <Link
              href="/account/orders"
              className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-1 mt-0.5"
            >
              Xem chi tiết <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Detailed Info Grid */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            Chi Tiết Thông Tin
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Full Name */}
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium">Họ và tên</span>
              <p className="font-bold text-slate-900 text-sm">{user.fullName}</p>
            </div>

            {/* Email */}
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Email đăng nhập</span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                  Đã xác thực
                </span>
              </div>
              <p className="font-bold text-slate-900 text-sm truncate">{user.email}</p>
            </div>

            {/* Phone Number */}
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium">Số điện thoại liên lạc</span>
              <p className="font-bold text-slate-900 text-sm">
                {user.phone ? user.phone : 'Chưa cập nhật'}
              </p>
            </div>

            {/* Account Role & Status */}
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium">Vai trò & Trạng thái</span>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="font-bold text-slate-900 text-sm uppercase">{user.role || 'CUSTOMER'}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Hoạt động tốt
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Security & System Info */}
        <div className="p-5 bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-2xl border border-slate-100 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Bảo Mật & Tiêu Chuẩn Doanh Nghiệp
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Tài khoản của bạn được bảo vệ bằng hệ thống mật mã một chiều <b>Bcrypt</b> và chữ ký số phân tán <b>JWT (JSON Web Token)</b>. 
            Mọi thao tác đặt hàng và thanh toán đều được đối soát qua kiến trúc SAGA Orchestration chống gian lận.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/account/orders"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all w-full sm:w-auto"
            >
              <Package className="w-4 h-4" /> Xem Đơn Hàng Của Tôi
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors w-full sm:w-auto"
            >
              <ShoppingBag className="w-4 h-4" /> Mua Sắm
            </Link>
          </div>

          <button
            type="button"
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors w-full sm:w-auto"
          >
            <LogOut className="w-4 h-4" /> Đăng Xuất Khỏi Thiết Bị
          </button>
        </div>
      </div>
    </div>
  );
}
