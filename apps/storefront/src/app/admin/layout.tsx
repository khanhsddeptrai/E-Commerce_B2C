'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Boxes,
  Package,
  ShoppingBag,
  Users,
  BarChart3,
  Settings,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  ExternalLink,
  ChevronRight,
  Loader2,
  Lock,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);

  // Khôi phục trạng thái thu gọn từ localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('admin_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {
      // Bỏ qua nếu môi trường không cho phép truy cập localStorage
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('admin_sidebar_collapsed', String(next));
      } catch {
        // Bỏ qua
      }
      return next;
    });
  };

  // 1. Màn hình chờ kiểm tra quyền xác thực
  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center space-y-4 text-white">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 animate-spin">
          <Loader2 className="w-7 h-7" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-bold tracking-wide">NovaTech Admin Console</p>
          <p className="text-xs text-slate-400">Đang xác thực thông tin Quản trị viên...</p>
        </div>
      </div>
    );
  }

  // 2. Chưa đăng nhập: Hiển thị màn hình chặn quyền
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-white tracking-tight">Khu Vực Quản Trị Hệ Thống</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bạn cần đăng nhập bằng tài khoản có vai trò <span className="text-indigo-400 font-bold">ADMIN</span> để truy cập bảng điều khiển này.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              href="/login?redirect=/admin/orders"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" /> Đăng Nhập Quản Trị Viên
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors"
            >
              Quay về Cửa Hàng
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Đã đăng nhập nhưng KHÔNG phải ADMIN: Chặn truy cập 403 Forbidden
  if (user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-900/40 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-bold">
              403 - Quyền Truy Cập Bị Từ Chối
            </span>
            <h1 className="text-xl font-black text-white tracking-tight mt-2">Không Đủ Đặc Quyền Quản Trị</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tài khoản <span className="font-semibold text-slate-200">{user.email}</span> hiện mang vai trò{' '}
              <span className="font-bold text-amber-400">{user.role}</span>. Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền truy cập trang này.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                logout();
                router.push('/login?redirect=/admin/orders');
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Đăng Nhập Bằng Tài Khoản Admin Khác
            </button>
            <Link
              href="/"
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors"
            >
              Quay Về Trang Mua Sắm
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Đã xác thực quyền ADMIN -> Render đầy đủ Layout Quản Trị Chuyên Nghiệp

  const navItems = [
    {
      name: 'Quản Lý Đơn Hàng',
      href: '/admin/orders',
      icon: Package,
      active: pathname === '/admin/orders' || pathname === '/admin',
      badge: null,
    },
    {
      name: 'Quản Lý Sản Phẩm',
      href: '#',
      icon: Boxes,
      active: false,
      badge: 'Sắp ra mắt',
    },
    {
      name: 'Khách Hàng',
      href: '#',
      icon: Users,
      active: false,
      badge: 'Sắp ra mắt',
    },
    {
      name: 'Báo Cáo Doanh Thu',
      href: '#',
      icon: BarChart3,
      active: false,
      badge: 'Sắp ra mắt',
    },
    {
      name: 'Cài Đặt Hệ Thống',
      href: '#',
      icon: Settings,
      active: false,
      badge: 'Sắp ra mắt',
    },
  ];

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between transition-all duration-300 ease-in-out ${
          /* Mobile Drawer */
          mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${
          /* Desktop Width */
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          <div className="h-16 border-b border-slate-800/80 px-4 flex items-center justify-between overflow-hidden relative transition-all duration-300">
            {/* Logo text & icon */}
            <div
              className={`flex items-center gap-2.5 transition-all duration-300 ease-in-out overflow-hidden ${
                isCollapsed ? 'opacity-0 max-w-0 pointer-events-none -translate-x-4' : 'opacity-100 max-w-[200px] translate-x-0'
              }`}
            >
              <div className="w-8 h-8 shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="truncate whitespace-nowrap">
                <span className="font-black text-sm text-white tracking-wider block">NOVATECH</span>
                <span className="text-[10px] text-indigo-400 block font-bold -mt-0.5 tracking-wider uppercase">
                  Admin Portal
                </span>
              </div>
            </div>

            {/* Toggle Button: Centered when collapsed, right-aligned when expanded */}
            <button
              type="button"
              onClick={toggleSidebar}
              title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              className={`transition-all duration-300 flex items-center justify-center shrink-0 ${
                isCollapsed
                  ? 'w-10 h-10 mx-auto rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-400 hover:text-white border border-slate-800 shadow-xs'
                  : 'p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-indigo-400 transition-transform hover:scale-110" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>

            {/* Mobile close */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white shrink-0 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Menu */}
          <div className="py-3 px-3 space-y-1 overflow-y-auto flex-1">
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                isCollapsed ? 'max-h-0 opacity-0 mb-0' : 'max-h-8 opacity-100 mb-2 px-3'
              }`}
            >
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  title={isCollapsed ? item.name : undefined}
                  className={`group relative flex items-center h-11 rounded-xl text-xs font-semibold transition-all duration-300 ease-in-out overflow-hidden ${
                    isCollapsed ? 'justify-center px-0 w-11 mx-auto' : 'px-3.5 w-full'
                  } ${
                    item.active
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 font-bold'
                      : item.badge
                        ? 'text-slate-500 hover:text-slate-400 cursor-not-allowed'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  {/* Fixed-size Icon Container to prevent jumping */}
                  <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${item.active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                  </div>

                  {/* Text Label & Badge with smooth width and opacity transition */}
                  <div
                    className={`flex items-center justify-between flex-1 min-w-0 transition-all duration-300 ease-in-out ${
                      isCollapsed
                        ? 'opacity-0 max-w-0 ml-0 pointer-events-none'
                        : 'opacity-100 max-w-[200px] ml-3'
                    }`}
                  >
                    <span className="truncate whitespace-nowrap">{item.name}</span>
                    {item.badge ? (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700/50 shrink-0 ml-1.5 whitespace-nowrap">
                        {item.badge}
                      </span>
                    ) : item.active ? (
                      <ChevronRight className="w-3.5 h-3.5 text-white/70 shrink-0 ml-1.5" />
                    ) : null}
                  </div>

                  {/* Hover Floating Tooltip when collapsed */}
                  {isCollapsed && (
                    <div className="pointer-events-none absolute left-full ml-3 hidden px-3 py-1.5 rounded-xl bg-slate-950 text-white text-xs font-semibold shadow-2xl border border-slate-800 whitespace-nowrap z-50 group-hover:flex items-center gap-1.5">
                      <span>{item.name}</span>
                      {item.badge && (
                        <span className="text-[10px] text-amber-400 font-normal">({item.badge})</span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 space-y-1.5 overflow-hidden transition-all duration-300">
          <Link
            href="/"
            target="_blank"
            title={isCollapsed ? 'Xem Cửa Hàng B2C' : undefined}
            className={`group relative flex items-center h-10 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-all duration-300 overflow-hidden ${
              isCollapsed ? 'justify-center px-0 w-11 mx-auto' : 'px-3.5 w-full justify-between'
            }`}
          >
            <div className="flex items-center">
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span
                className={`truncate whitespace-nowrap transition-all duration-300 ease-in-out ${
                  isCollapsed ? 'opacity-0 max-w-0 ml-0' : 'opacity-100 max-w-[140px] ml-2.5'
                }`}
              >
                Xem Cửa Hàng B2C
              </span>
            </div>
            <ExternalLink
              className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-all duration-300 ${
                isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
              }`}
            />
            {isCollapsed && (
              <div className="pointer-events-none absolute left-full ml-3 hidden px-3 py-1.5 rounded-xl bg-slate-950 text-white text-xs font-semibold shadow-2xl border border-slate-800 whitespace-nowrap z-50 group-hover:block">
                Xem Cửa Hàng B2C
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={() => {
              logout();
              router.push('/login');
            }}
            title={isCollapsed ? 'Đăng Xuất Admin' : undefined}
            className={`group relative flex items-center h-10 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-all duration-300 overflow-hidden ${
              isCollapsed ? 'justify-center px-0 w-11 mx-auto' : 'px-3.5 w-full'
            }`}
          >
            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            <span
              className={`truncate whitespace-nowrap transition-all duration-300 ease-in-out ${
                isCollapsed ? 'opacity-0 max-w-0 ml-0' : 'opacity-100 max-w-[140px] ml-2.5'
              }`}
            >
              Đăng Xuất Admin
            </span>
            {isCollapsed && (
              <div className="pointer-events-none absolute left-full ml-3 hidden px-3 py-1.5 rounded-xl bg-slate-950 text-rose-400 text-xs font-semibold shadow-2xl border border-slate-800 whitespace-nowrap z-50 group-hover:block">
                Đăng Xuất Admin
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Top Header Bar */}
        <header className="h-16 px-4 sm:px-8 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>



            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 hidden sm:inline">Admin Console</span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <span className="font-bold text-white">Quản Lý Đơn Hàng</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Microservices Online
            </span>
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-white">{user.fullName || user.email}</p>
              <p className="text-[10px] text-indigo-400 font-semibold">Quyền Quản Trị Hệ Thống</p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 bg-slate-950 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
