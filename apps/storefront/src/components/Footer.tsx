import React from "react";
import Link from "next/link";
import { Cpu, Mail, Phone, MapPin, ShieldCheck, RefreshCw, Truck, Headphones } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 text-xs border-t border-slate-900">
      {/* 4 Brand Value Pillars */}
      <div className="border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Giao Hỏa Tốc 2H</h4>
              <p className="text-slate-400 mt-1">Miễn phí giao hàng toàn quốc cho đơn từ 2.000.000₫</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Bảo Hành 24 Tháng</h4>
              <p className="text-slate-400 mt-1">Cam kết 1 đổi 1 trong 30 ngày nếu phát sinh lỗi phần cứng</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400 shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Đổi Trả Dễ Dàng</h4>
              <p className="text-slate-400 mt-1">Thủ tục đơn giản qua app hoặc hotline trong 7 ngày</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Hỗ Trợ Kỹ Thuật 24/7</h4>
              <p className="text-slate-400 mt-1">Đội ngũ chuyên gia công nghệ giải đáp trực tuyến thời gian thực</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-5 gap-8">
        <div className="md:col-span-2 space-y-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <Cpu className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">
              NOVA<span className="text-indigo-500">TECH</span>
            </span>
          </Link>
          <p className="text-slate-400 leading-relaxed max-w-sm">
            Hệ sinh thái thiết bị công nghệ và đồ dùng thông minh cao cấp B2C. Tiên phong giải pháp âm thanh Hi-Res, phụ kiện bàn làm việc công thái học và thiết bị đeo thông minh.
          </p>
          <div className="space-y-2 text-slate-400">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-400" />
              <span>Hotline CSKH: 1900 8899 (8:00 - 22:00)</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400" />
              <span>Email: support@novatech.vn</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-400" />
              <span>Flagship Store: Tòa nhà Landmark, Quận 1, TP. Hồ Chí Minh</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white mb-3">Danh Mục Sản Phẩm</h4>
          <ul className="space-y-2">
            <li>
              <Link href="/products?category=cat-audio" className="hover:text-white transition-colors">
                Tai Nghe Chống Ồn ANC
              </Link>
            </li>
            <li>
              <Link href="/products?category=cat-audio" className="hover:text-white transition-colors">
                Loa Bluetooth Hi-Res
              </Link>
            </li>
            <li>
              <Link href="/products?category=cat-wearables" className="hover:text-white transition-colors">
                Đồng Hồ Thông Minh Titanium
              </Link>
            </li>
            <li>
              <Link href="/products?category=cat-desk" className="hover:text-white transition-colors">
                Bàn Phím Cơ Custom
              </Link>
            </li>
            <li>
              <Link href="/products?category=cat-charging" className="hover:text-white transition-colors">
                Sạc Nhanh GaN 140W
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white mb-3">Hỗ Trợ Khách Hàng</h4>
          <ul className="space-y-2">
            <li>
              <Link href="/products" className="hover:text-white transition-colors">
                Tra cứu bảo hành điện tử
              </Link>
            </li>
            <li>
              <Link href="/products" className="hover:text-white transition-colors">
                Chính sách giao hàng 2h
              </Link>
            </li>
            <li>
              <Link href="/products" className="hover:text-white transition-colors">
                Chính sách đổi trả 30 ngày
              </Link>
            </li>
            <li>
              <Link href="/products" className="hover:text-white transition-colors">
                Điều khoản dịch vụ B2C
              </Link>
            </li>
            <li>
              <Link href="/products" className="hover:text-white transition-colors">
                Bảo mật thông tin thanh toán
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white mb-3">Đăng Ký Nhận Tin</h4>
          <p className="text-slate-400 mb-3">Nhận ngay voucher 15% cho đơn hàng đầu tiên.</p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Email của bạn..."
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 flex-1"
            />
            <button className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors">
              Gửi
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-900">
            <p className="text-[11px] text-slate-500">Chấp nhận thanh toán qua VNPAY, MoMo, Visa, Mastercard.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-900 py-6 text-center text-slate-600 text-[11px]">
        © {new Date().getFullYear()} NovaTech B2C E-Commerce System. All rights reserved.
      </div>
    </footer>
  );
}
