"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Star,
  ShieldCheck,
  Truck,
  RefreshCw,
  ShoppingBag,
  Zap,
  Check,
  Share2,
  Heart,
  ChevronRight,
  Cpu,
  Layers,
  ArrowRight,
} from "lucide-react";
import { MOCK_PRODUCTS } from "@/mock/products";
import { Product, ProductVariant } from "@/types/ecommerce";
import { useCart } from "@/context/CartContext";
import { ProductCard } from "@/components/ProductCard";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();

  const slug = params.slug as string;
  const product = MOCK_PRODUCTS.find((p) => p.slug === slug) || MOCK_PRODUCTS[0];

  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [activeImage, setActiveImage] = useState(product.images[0]);
  const [quantity, setQuantity] = useState(1);
  const [isAddedToast, setIsAddedToast] = useState(false);

  // Sync state if slug changes
  useEffect(() => {
    setSelectedVariantIndex(0);
    setActiveImage(product.images[0]);
    setQuantity(1);
  }, [slug, product]);

  const activeVariant = product.variants[selectedVariantIndex] || product.variants[0];

  const handleVariantChange = (index: number) => {
    setSelectedVariantIndex(index);
    const variant = product.variants[index];
    if (variant && variant.image) {
      setActiveImage(variant.image);
    }
  };

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(p);
  };

  const handleAddToCart = () => {
    if (activeVariant) {
      addToCart(product, activeVariant, quantity);
      setIsAddedToast(true);
      setTimeout(() => setIsAddedToast(false), 2000);
    }
  };

  const handleBuyNow = () => {
    if (activeVariant) {
      addToCart(product, activeVariant, quantity);
      router.push("/checkout");
    }
  };

  const relatedProducts = MOCK_PRODUCTS.filter(
    (p) => p.id !== product.id && p.categoryId === product.categoryId
  ).slice(0, 3);

  const displayPrice = activeVariant?.price || product.basePrice;
  const originalPrice = activeVariant?.originalPrice || product.originalPrice;
  const discountPercent =
    originalPrice && originalPrice > displayPrice
      ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-indigo-600 transition-colors">
          Trang Chủ
        </Link>
        <span>/</span>
        <Link
          href={`/products?category=${product.categoryId}`}
          className="hover:text-indigo-600 transition-colors"
        >
          {product.categoryName}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Interactive Image Gallery (Col 7) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Large Image */}
          <div className="relative aspect-square sm:aspect-[4/3] rounded-3xl overflow-hidden bg-white border border-slate-200/80 shadow-sm flex items-center justify-center group">
            <img
              src={activeImage}
              alt={product.name}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            {product.badge && (
              <span className="absolute top-4 left-4 bg-slate-900 text-white text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full shadow-md">
                {product.badge}
              </span>
            )}
          </div>

          {/* Thumbnails switcher */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImage(img)}
                className={`relative w-20 h-20 rounded-2xl overflow-hidden bg-white border-2 transition-all shrink-0 ${
                  activeImage === img
                    ? "border-indigo-600 ring-2 ring-indigo-600/20 scale-105"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <img src={img} alt="thumbnail" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Product Details & Buying Actions (Col 5) */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                {product.brand}
              </span>
              <span className="text-xs text-slate-400">• SKU: {activeVariant?.sku}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
              {product.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              {product.tagline}
            </p>

            {/* Ratings summary */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{product.rating}</span>
              </div>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-500 underline cursor-pointer">
                {product.reviewCount} đánh giá đã xác thực
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-xs font-semibold text-emerald-600">Còn hàng</span>
            </div>
          </div>

          {/* Pricing Banner */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Giá bán chính hãng (Đã gồm VAT)</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {formatPrice(displayPrice)}
                </span>
                {originalPrice && originalPrice > displayPrice && (
                  <span className="text-sm text-slate-400 line-through">
                    {formatPrice(originalPrice)}
                  </span>
                )}
              </div>
            </div>
            {discountPercent && (
              <div className="bg-rose-500 text-white font-bold text-xs px-2.5 py-1 rounded-xl shadow-sm">
                Tiết kiệm {discountPercent}%
              </div>
            )}
          </div>

          {/* Dynamic Variant Selector: Colors & Models */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">
                Tùy chọn phiên bản / Màu sắc:{" "}
                <span className="text-indigo-600">{activeVariant?.colorName}</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {product.variants.map((v, idx) => (
                  <button
                    key={v.id}
                    onClick={() => handleVariantChange(idx)}
                    className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      selectedVariantIndex === idx
                        ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: v.colorHex }}
                      />
                      <span className="text-xs font-bold text-slate-900 truncate">{v.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600">
                      {formatPrice(v.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center gap-4 pt-2">
              <label className="text-xs font-bold text-slate-700">Số lượng:</label>
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 text-slate-500 hover:bg-slate-100 font-bold"
                  aria-label="Giảm"
                >
                  -
                </button>
                <span className="px-4 text-xs font-bold text-slate-900 min-w-[32px] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(activeVariant?.stock || 10, q + 1))}
                  className="px-3 py-2 text-slate-500 hover:bg-slate-100 font-bold"
                  aria-label="Tăng"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-slate-400">
                (Kho còn {activeVariant?.stock || 15} sản phẩm)
              </span>
            </div>
          </div>

          {/* Action Buttons: Add to Cart & Buy Now */}
          <div className="space-y-2.5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleAddToCart}
                className="py-3.5 px-4 rounded-xl border-2 border-indigo-600 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {isAddedToast ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Đã thêm vào giỏ!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Thêm Vào Giỏ Hàng</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBuyNow}
                className="py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Mua Ngay Giao 2H</span>
              </button>
            </div>

            {/* Policy & Trust badges */}
            <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-slate-200 text-center">
              <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 hover:border-indigo-200 shadow-sm transition-all">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center mx-auto mb-1.5 shadow-sm">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 block">
                  Freeship từ 2 Triệu
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 hover:border-indigo-200 shadow-sm transition-all">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center mx-auto mb-1.5 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 block">
                  Bảo hành 24 tháng
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 hover:border-indigo-200 shadow-sm transition-all">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center mx-auto mb-1.5 shadow-sm">
                  <RefreshCw className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 block">
                  1 đổi 1 trong 30 ngày
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Specifications Sheet & In-depth Description */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-10 border-t border-slate-200">
        {/* Description (Col 7) */}
        <div className="lg:col-span-7 space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Chi Tiết Sản Phẩm & Trải Nghiệm</h2>
          <div className="prose text-slate-600 text-sm leading-relaxed space-y-4">
            <p>{product.description}</p>
            <p>
              Sản phẩm được gia công với độ hoàn thiện cực kỳ tinh xảo, đáp ứng những yêu cầu khắt khe nhất của người dùng công nghệ đam mê trải nghiệm chất lượng đỉnh cao.
            </p>
          </div>
        </div>

        {/* Specs Table (Col 5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-sm">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            Bảng Thông Số Kỹ Thuật
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {product.specs.map((item, idx) => (
              <div key={idx} className="py-2.5 flex justify-between gap-4">
                <span className="text-slate-400 font-medium shrink-0">{item.label}</span>
                <span className="text-slate-900 font-semibold text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Related Products Carousel / Grid */}
      {relatedProducts.length > 0 && (
        <div className="pt-12 border-t border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Thiết Bị Cùng Hệ Sinh Thái</h2>
            <Link
              href={`/products?category=${product.categoryId}`}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
