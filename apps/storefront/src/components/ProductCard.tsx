"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, ShoppingBag, Check, Zap, Eye } from "lucide-react";
import { Product } from "@/types/ecommerce";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { ImagePreviewModal } from "@/components/ImagePreviewModal";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [isAdded, setIsAdded] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const activeVariant = product.variants[selectedVariantIndex] || product.variants[0];
  const displayImage = activeVariant?.image || product.images[0];
  const [imgSrc, setImgSrc] = useState(displayImage);

  React.useEffect(() => {
    setImgSrc(displayImage);
  }, [displayImage]);

  const displayPrice = activeVariant?.price || product.basePrice;
  const originalPrice = activeVariant?.originalPrice || product.originalPrice;

  const discountPercent =
    originalPrice && originalPrice > displayPrice
      ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
      : null;

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push(`/login?redirect=/products/${product.slug}`);
      return;
    }
    if (activeVariant) {
      addToCart(product, activeVariant, 1);
      setIsAdded(true);
      setTimeout(() => setIsAdded(false), 1500);
    }
  };

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 flex flex-col overflow-hidden">
      {/* Product Image Area */}
      <Link href={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-slate-50 cursor-pointer">
        <img
          src={imgSrc}
          alt={product.name}
          onError={() =>
            setImgSrc(
              "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=1000&auto=format&fit=crop&q=85"
            )
          }
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 cursor-pointer"
          loading="lazy"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {product.badge && (
            <span
              className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full shadow-sm ${
                product.badge.includes("FLASH")
                  ? "bg-amber-500 text-white"
                  : product.badge.includes("MỚI")
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-900 text-white"
              }`}
            >
              {product.badge}
            </span>
          )}
          {discountPercent && (
            <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full shadow-sm w-fit">
              -{discountPercent}%
            </span>
          )}
        </div>

        {/* Stock status pill */}
        {activeVariant?.stock <= 10 && activeVariant?.stock > 0 && (
          <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm text-amber-300 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Chỉ còn {activeVariant.stock} sản phẩm
          </div>
        )}

        {/* Quick Image Preview Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsPreviewOpen(true);
          }}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-slate-950/75 hover:bg-indigo-600 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all shadow-md cursor-pointer hover:scale-110"
          title="Xem trước ảnh"
          aria-label="Xem trước ảnh"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </Link>

      {/* Content Area */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          {/* Category & Rating */}
          <div className="flex items-center justify-between gap-2 mb-1.5 text-xs">
            <span className="text-slate-400 font-medium truncate">{product.categoryName}</span>
            <div className="flex items-center gap-1 text-amber-500 font-semibold shrink-0">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
              <span className="text-slate-400 text-[11px] font-normal">({product.reviewCount})</span>
            </div>
          </div>

          {/* Product Title */}
          <Link href={`/products/${product.slug}`} className="block">
            <h3 className="font-semibold text-slate-900 text-sm md:text-base group-hover:text-indigo-600 transition-colors line-clamp-1 leading-snug">
              {product.name}
            </h3>
            <p className="text-xs text-slate-500 line-clamp-1 mt-1">{product.tagline}</p>
          </Link>

          {/* Color swatches preview (Fixed height row to ensure card alignment) */}
          <div className="flex items-center gap-1.5 mt-3 min-h-[26px]">
            {product.variants.length > 1 ? (
              <>
                {product.variants.map((variant, idx) => (
                  <button
                    key={variant.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedVariantIndex(idx);
                    }}
                    className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${
                      selectedVariantIndex === idx
                        ? "ring-2 ring-indigo-600 ring-offset-1 scale-110 border-transparent"
                        : "border-slate-300 hover:scale-105"
                    }`}
                    style={{ backgroundColor: variant.colorHex }}
                    title={variant.colorName}
                    aria-label={variant.colorName}
                  />
                ))}
                <span className="text-[11px] text-slate-400 ml-1">
                  {product.variants.length} màu
                </span>
              </>
            ) : (
              <span className="text-[11px] text-slate-400">
                Phiên bản: {activeVariant?.name || "Tiêu chuẩn"}
              </span>
            )}
          </div>
        </div>

        {/* Price & Action Button */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
          <div>
            <div className="text-base font-bold text-slate-900 leading-none">
              {formatPrice(displayPrice)}
            </div>
            {originalPrice && originalPrice > displayPrice && (
              <div className="text-[11px] text-slate-400 line-through mt-0.5">
                {formatPrice(originalPrice)}
              </div>
            )}
          </div>

          <button
            onClick={handleQuickAdd}
            disabled={activeVariant?.stock === 0}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
              isAdded
                ? "bg-emerald-600 text-white shadow-sm"
                : activeVariant?.stock === 0
                ? "bg-slate-100 text-slate-400 !cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20 active:scale-95"
            }`}
            aria-label="Thêm vào giỏ hàng"
          >
            {isAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Đã thêm</span>
              </>
            ) : activeVariant?.stock === 0 ? (
              <span>Hết hàng</span>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thêm giỏ</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        images={product.images.length > 0 ? product.images : [imgSrc]}
        productName={product.name}
      />
    </div>
  );
}
