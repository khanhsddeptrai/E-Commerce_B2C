"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Search, Menu, X, Cpu, Sparkles, ChevronRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { MOCK_PRODUCTS } from "@/mock/products";
import { Product } from "@/types/ecommerce";

export function Navbar() {
  const router = useRouter();
  const { totalItems, openCart } = useCart();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle live search suggestions
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      const matched = MOCK_PRODUCTS.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q)
      ).slice(0, 4);
      setSearchResults(matched);
      setIsSearchOpen(true);
    } else {
      setSearchResults([]);
      setIsSearchOpen(false);
    }
  }, [searchQuery]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchOpen(false);
      router.push(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(p);
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        isScrolled ? "glass-nav shadow-sm" : "bg-white/95 backdrop-blur-md border-b border-slate-100"
      }`}
    >
      {/* Top micro banner */}
      <div className="bg-slate-950 text-slate-300 text-xs py-1.5 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> FLASH SALE CÔNG NGHỆ:
        </span>
        <span>Nhập mã <b>NOVATECH10</b> giảm ngay 10% cho mọi đơn hàng từ 1 triệu</span>
        <span className="hidden md:inline text-slate-500">|</span>
        <span className="hidden md:inline text-slate-400">Miễn phí giao hàng toàn quốc từ 2.000.000₫</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-slate-900 leading-none">
                NOVA<span className="text-indigo-600">TECH</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wider uppercase mt-0.5">
                Smart Devices B2C
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600">
            <Link href="/" className="hover:text-indigo-600 transition-colors">
              Trang Chủ
            </Link>
            <Link href="/products" className="hover:text-indigo-600 transition-colors">
              Tất Cả Thiết Bị
            </Link>
            <Link
              href="/products?category=cat-audio"
              className="hover:text-indigo-600 transition-colors"
            >
              Âm Thanh Hi-Res
            </Link>
            <Link
              href="/products?category=cat-wearables"
              className="hover:text-indigo-600 transition-colors"
            >
              Smartwatch
            </Link>
            <Link
              href="/products?category=cat-desk"
              className="hover:text-indigo-600 transition-colors"
            >
              Desk Setup
            </Link>
          </nav>

          {/* Search Bar with live autocomplete */}
          <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setIsSearchOpen(true)}
                  placeholder="Tìm tai nghe ANC, bàn phím cơ, smartwatch..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-900 placeholder:text-slate-400 rounded-full border border-transparent focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </form>

            {/* Autocomplete Dropdown */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="text-[11px] font-semibold text-slate-400 px-3 py-1.5 uppercase tracking-wider">
                  Gợi ý sản phẩm
                </div>
                {searchResults.map((item) => (
                  <Link
                    key={item.id}
                    href={`/products/${item.slug}`}
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors group"
                  >
                    <img
                      src={item.images[0]}
                      alt={item.name}
                      className="w-11 h-11 rounded-lg object-cover bg-slate-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-indigo-600">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{item.categoryName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-indigo-600">
                        {formatPrice(item.basePrice)}
                      </span>
                    </div>
                  </Link>
                ))}
                <div className="border-t border-slate-100 mt-1 pt-1 text-center">
                  <button
                    onClick={handleSearchSubmit}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 py-1.5 w-full flex items-center justify-center gap-1"
                  >
                    Xem tất cả kết quả cho "{searchQuery}" <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Action Icons: Cart */}
          <div className="flex items-center gap-2">
            <button
              onClick={openCart}
              className="relative p-2.5 rounded-full hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-2 group"
              aria-label="Xem giỏ hàng"
            >
              <div className="relative">
                <ShoppingBag className="w-5 h-5 group-hover:scale-105 transition-transform" />
                {totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-indigo-600 text-white text-[11px] font-bold h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center shadow-sm animate-in zoom-in">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-slate-700">Giỏ hàng</span>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-700 lg:hidden"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200/80 py-4 px-2 space-y-3 animate-in fade-in">
            {/* Mobile Search */}
            <form onSubmit={handleSearchSubmit} className="mb-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm sản phẩm..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100 text-slate-900 rounded-lg outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </form>

            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Trang Chủ
            </Link>
            <Link
              href="/products"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Tất Cả Thiết Bị
            </Link>
            <Link
              href="/products?category=cat-audio"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Âm Thanh & Tai Nghe
            </Link>
            <Link
              href="/products?category=cat-wearables"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Đồng Hồ & Wearables
            </Link>
            <Link
              href="/products?category=cat-desk"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Desk Setup & Bàn Phím
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
