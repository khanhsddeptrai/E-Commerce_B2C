"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  SlidersHorizontal,
  Search,
  X,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { productService } from "@/services/productService";
import { Product, Category } from "@/types/ecommerce";

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialCat = searchParams.get("category") || "all";
  const initialQuery = searchParams.get("q") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCat);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [priceRange, setPriceRange] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("featured");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Fetch live products & categories
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
        console.error("Lỗi tải danh mục sản phẩm:", err);
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Sync state if URL changes
  useEffect(() => {
    const cat = searchParams.get("category") || "all";
    const q = searchParams.get("q") || "";
    setSelectedCategory(cat);
    setSearchQuery(q);
  }, [searchParams]);

  // Filter products logic
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Filter by Category
    if (selectedCategory !== "all") {
      list = list.filter(
        (p) => p.categoryId === selectedCategory || p.categoryName.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q)
      );
    }

    // Filter by Price Range
    if (priceRange === "under-2m") {
      list = list.filter((p) => p.basePrice < 2000000);
    } else if (priceRange === "2m-4m") {
      list = list.filter((p) => p.basePrice >= 2000000 && p.basePrice <= 4000000);
    } else if (priceRange === "over-4m") {
      list = list.filter((p) => p.basePrice > 4000000);
    }

    // Sort
    switch (sortBy) {
      case "price-asc":
        list.sort((a, b) => a.basePrice - b.basePrice);
        break;
      case "price-desc":
        list.sort((a, b) => b.basePrice - a.basePrice);
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "featured":
      default:
        list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
    }

    return list;
  }, [products, selectedCategory, searchQuery, priceRange, sortBy]);

  const clearAllFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    setPriceRange("all");
    setSortBy("featured");
    router.push("/products");
  };

  const hasActiveFilters =
    selectedCategory !== "all" || searchQuery.trim() !== "" || priceRange !== "all";

  const activeCategoryObj = categories.find(
    (c) => c.id === selectedCategory || c.slug === selectedCategory
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <nav className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Link href="/" className="hover:text-indigo-600 transition-colors">
              Trang Chủ
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Danh Mục Thiết Bị</span>
            {selectedCategory !== "all" && activeCategoryObj && (
              <>
                <span>/</span>
                <span className="text-indigo-600 font-semibold">
                  {activeCategoryObj.name}
                </span>
              </>
            )}
          </nav>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Danh Mục Thiết Bị Công Nghệ
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Hiển thị <b>{filteredProducts.length}</b> sản phẩm phù hợp tiêu chí tìm kiếm.
          </p>
        </div>

        {/* Sorting Dropdown & Mobile Filter Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileFilterOpen(true)}
            className="md:hidden flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Bộ lọc ({hasActiveFilters ? "Đang lọc" : "Tất cả"})</span>
          </button>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-sm">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 hidden sm:inline">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer"
            >
              <option value="featured">Nổi Bật Nhất</option>
              <option value="price-asc">Giá: Thấp đến Cao</option>
              <option value="price-desc">Giá: Cao đến Thấp</option>
              <option value="rating">Đánh Giá Cao Nhất</option>
              <option value="newest">Hàng Mới Về</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Sidebar Filters + Products */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        {/* DESKTOP SIDEBAR FILTERS */}
        <aside className="hidden md:block bg-white rounded-2xl border border-slate-200/80 p-5 space-y-6 sticky top-24 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              Bộ Lọc Tìm Kiếm
            </h3>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Đặt lại
              </button>
            )}
          </div>

          {/* Search Input Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">Tìm kiếm từ khóa</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nhập tên sản phẩm..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">Dòng sản phẩm</label>
            <div className="space-y-1 text-xs">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-colors flex items-center justify-between ${
                  selectedCategory === "all"
                    ? "bg-indigo-50 text-indigo-700 font-bold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>Tất Cả Danh Mục</span>
                <span className="text-[11px] text-slate-400">{products.length}</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-colors flex items-center justify-between ${
                    selectedCategory === cat.id
                      ? "bg-indigo-50 text-indigo-700 font-bold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className="text-[11px] text-slate-400">{cat.itemCount}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price Range Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">Mức giá ngân sách</label>
            <div className="space-y-1.5 text-xs text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900">
                <input
                  type="radio"
                  name="priceRange"
                  checked={priceRange === "all"}
                  onChange={() => setPriceRange("all")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Tất cả mức giá</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900">
                <input
                  type="radio"
                  name="priceRange"
                  checked={priceRange === "under-2m"}
                  onChange={() => setPriceRange("under-2m")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Dưới 2.000.000₫</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900">
                <input
                  type="radio"
                  name="priceRange"
                  checked={priceRange === "2m-4m"}
                  onChange={() => setPriceRange("2m-4m")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>2.000.000₫ - 4.000.000₫</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900">
                <input
                  type="radio"
                  name="priceRange"
                  checked={priceRange === "over-4m"}
                  onChange={() => setPriceRange("over-4m")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Trên 4.000.000₫</span>
              </label>
            </div>
          </div>
        </aside>

        {/* PRODUCT LIST GRID */}
        <div className="md:col-span-3 space-y-6">
          {/* Active filter badges bar */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-slate-700">
              <span className="font-semibold text-indigo-700">Đang lọc:</span>
              {selectedCategory !== "all" && activeCategoryObj && (
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-700 font-medium">
                  {activeCategoryObj.name}
                  <button onClick={() => setSelectedCategory("all")}>
                    <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-700 font-medium">
                  Từ khóa: "{searchQuery}"
                  <button onClick={() => setSearchQuery("")}>
                    <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                  </button>
                </span>
              )}
              {priceRange !== "all" && (
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-700 font-medium">
                  Giá: {priceRange === "under-2m" ? "< 2 triệu" : priceRange === "2m-4m" ? "2 - 4 triệu" : "> 4 triệu"}
                  <button onClick={() => setPriceRange("all")}>
                    <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                  </button>
                </span>
              )}
              <button
                onClick={clearAllFilters}
                className="text-xs font-semibold text-rose-600 hover:underline ml-auto"
              >
                Xóa tất cả
              </button>
            </div>
          )}

          {/* Products Grid or Empty State */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Không tìm thấy sản phẩm nào</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Rất tiếc, không có thiết bị công nghệ nào khớp với tiêu chí lọc hiện tại của bạn. Hãy thử từ khóa khác hoặc bỏ các bộ lọc.
              </p>
              <button
                onClick={clearAllFilters}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Xóa toàn bộ bộ lọc
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">
          Đang tải danh mục sản phẩm...
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
