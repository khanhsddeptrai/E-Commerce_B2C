"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  Layers,
  Cpu,
  ChevronRight,
  BatteryCharging,
  Radio,
} from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { FlashSaleCountdown } from "@/components/FlashSaleCountdown";
import { productService } from "@/services/productService";
import { Product, Category } from "@/types/ecommerce";

export default function HomePage() {
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      productService.getProducts(),
      productService.getCategories(),
    ])
      .then(([prodRes, catList]) => {
        if (mounted) {
          setProducts(prodRes.products);
          setCategories(catList);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Lỗi tải dữ liệu trang chủ:", err);
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const flagshipProduct = products.find((p) => p.featured) || products[0];
  const flashSaleProducts = products.filter((p) => p.isFlashSale);

  const filteredProducts =
    activeCategoryTab === "all"
      ? products
      : products.filter((p) => p.categoryId === activeCategoryTab);

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(p);
  };

  return (
    <div className="space-y-16 pb-20">
      {/* 1. HERO SECTION: Dark Futuristic Tech Showcase */}
      <section className="relative overflow-hidden bg-slate-950 text-white pt-12 pb-20 md:py-24 border-b border-slate-900">
        {/* Ambient background glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-semibold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                FLAGSHIP 2026 • MỚI RA MẮT
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] text-white">
                Đắm chìm vào chuẩn âm thanh <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-300 to-amber-300">Hi-Res Lossless</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
                {flagshipProduct
                  ? `${flagshipProduct.name}. ${flagshipProduct.tagline} ${flagshipProduct.description.slice(0, 120)}...`
                  : "Tai nghe chống ồn thích ứng Nova SoundCore Ultra ANC. Màng loa Titanium 40mm, chip xử lý âm thanh kép Dual-DSP triệt tiêu 48dB tạp âm, thời lượng pin ấn tượng đến 65 giờ."}
              </p>

              {/* Key Highlights Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-indigo-400 text-xs font-medium flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" /> Hi-Res LDAC
                  </div>
                  <div className="text-white text-sm font-bold mt-1">96kHz / 24-bit</div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-indigo-400 text-xs font-medium flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Hybrid ANC
                  </div>
                  <div className="text-white text-sm font-bold mt-1">-48dB Khử ồn</div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-indigo-400 text-xs font-medium flex items-center gap-1.5">
                    <BatteryCharging className="w-3.5 h-3.5" /> Thời lượng pin
                  </div>
                  <div className="text-white text-sm font-bold mt-1">65H Phát nhạc</div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-indigo-400 text-xs font-medium flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" /> Màng loa
                  </div>
                  <div className="text-white text-sm font-bold mt-1">40mm Titanium</div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                {flagshipProduct ? (
                  <Link
                    href={`/products/${flagshipProduct.slug}`}
                    className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Đặt Mua Ngay — {formatPrice(flagshipProduct.basePrice)}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link
                    href="/products"
                    className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2.5 transition-all"
                  >
                    <span>Khám Phá Sản Phẩm</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
                <Link
                  href="/products"
                  className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white font-medium text-sm rounded-xl transition-all"
                >
                  Khám Phá Tất Cả Thiết Bị
                </Link>
              </div>
            </div>

            {/* Right Showcase Visual */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                <div className="aspect-square rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl relative group bg-gradient-to-b from-slate-900 to-slate-950">
                  {flagshipProduct?.images?.[0] ? (
                    <img
                      src={flagshipProduct.images[0]}
                      alt={flagshipProduct.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Cpu className="w-16 h-16 animate-pulse" />
                    </div>
                  )}
                  {/* Floating Specs Pill */}
                  {flagshipProduct && (
                    <div className="absolute bottom-4 left-4 right-4 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 text-xs flex items-center justify-between">
                      <div>
                        <div className="text-amber-400 font-semibold flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 fill-amber-400" /> Sẵn sàng giao hỏa tốc 2h
                        </div>
                        <div className="text-slate-300 font-medium mt-0.5">Bảo hành 24 tháng chính hãng</div>
                      </div>
                      <Link
                        href={`/products/${flagshipProduct.slug}`}
                        className="px-3 py-1.5 bg-white text-slate-950 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        Chi tiết
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FLASH SALE SECTION: Live Ticking Countdown */}
      {flashSaleProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-3xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Zap className="w-6 h-6 fill-amber-500 text-amber-500" />
                    Giờ Vàng Công Nghệ • Flash Sale
                  </h2>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Ưu đãi chớp nhoáng với cơ chế giữ chỗ kho phân tán thời gian thực.
                </p>
              </div>
              <FlashSaleCountdown />
            </div>

            {/* Flash Sale Grid (Equal height & aligned baselines) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {flashSaleProducts.map((product) => {
                const sold = product.flashSaleSold || 40;
                const total = product.flashSaleTotal || 50;
                const percent = Math.min(100, Math.round((sold / total) * 100));

                return (
                  <div
                    key={product.id}
                    className="flex flex-col justify-between h-full bg-white rounded-2xl border border-amber-200/80 shadow-sm p-4"
                  >
                    <div className="flex-1 flex flex-col">
                      <ProductCard product={product} />
                    </div>

                    {/* Stock reservation progress bar (Pinned to bottom) */}
                    <div className="mt-auto pt-3 border-t border-slate-100">
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                        <span className="text-amber-600 flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 fill-amber-500" /> Đã bán {sold}/{total}
                        </span>
                        <span>{percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </section>
      )}

      {/* 3. CATEGORY EXPLORER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Hệ Sinh Thái Thiết Bị
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Khám phá các dòng sản phẩm công nghệ thông minh đáp ứng trọn vẹn nhu cầu làm việc & giải trí.
            </p>
          </div>
          <Link
            href="/products"
            className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            Xem tất cả <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.id}`}
              className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 flex flex-col justify-between overflow-hidden"
            >
              <div>
                <div className="aspect-[4/3] rounded-xl overflow-hidden mb-4 bg-slate-100">
                  <img
                    src={cat.featuredImage}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">
                    {cat.name}
                  </h3>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                    {cat.itemCount} sản phẩm
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{cat.description}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                <span>Khám phá danh mục</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. TRENDING TECH SHOWCASE WITH CATEGORY TABS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Bán chạy nhất
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Sản Phẩm Được Ưa Chuộng
            </h2>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setActiveCategoryTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeCategoryTab === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Tất Cả
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryTab(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  activeCategoryTab === cat.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 5. CRAFTSMANSHIP & HARDWARE QUALITY PILLARS */}
      <section className="bg-slate-900 text-white py-16 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Chuẩn Mực Chế Tác Công Nghệ Đỉnh Cao
            </h2>
            <p className="text-slate-400 text-sm mt-3">
              Mỗi sản phẩm NovaTech đều trải qua hơn 100 bài kiểm tra độ bền, độ chính xác âm học và tính an toàn điện trường trước khi đến tay người tiêu dùng.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Vật Liệu Hàng Không Vũ Trụ</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Khung vỏ Titanium Grade 5, mặt kính Sapphire Crystal và hợp kim nhôm CNC nguyên khối mang lại độ bền cơ học vượt trội cùng trọng lượng siêu nhẹ.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Bán Dẫn GaN III & DSP Kép</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Ứng dụng chip bán dẫn Gallium Nitride thế hệ 3 tăng hiệu suất sạc 40% mát mẻ, cùng vi xử lý tín hiệu số DSP kép xử lý âm thanh thời gian thực.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Cam Kết Bảo Hành 1 Đổi 1</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Chính sách bảo hành 24 tháng độc quyền: Nếu xuất hiện lỗi kỹ thuật từ nhà sản xuất, khách hàng được đổi ngay thiết bị mới nguyên seal trong 30 ngày.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
