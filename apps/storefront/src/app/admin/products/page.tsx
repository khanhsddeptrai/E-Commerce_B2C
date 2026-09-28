'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Boxes,
  Package,
  Search,
  Plus,
  RefreshCw,
  Edit3,
  Eye,
  EyeOff,
  Archive,
  Trash2,
  X,
  Check,
  Loader2,
  UploadCloud,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Tag,
  Sparkles,
} from 'lucide-react';
import { productService } from '@/services/productService';
import { Product, Category, Brand, CreateProductInput, UpdateProductInput } from '@/types/ecommerce';
import { Tooltip } from '@/components/Tooltip';
import { ResizableDrawer } from '@/components/ResizableDrawer';

type StatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';

interface SkuFormItem {
  id?: string;
  sku_code: string;
  name: string;
  color_name: string;
  color_hex: string;
  price: number;
  original_price?: number;
  stock_quantity: number;
  image_url?: string;
  specs_json?: string;
}

interface SpecFormItem {
  label: string;
  value: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Mở rộng dòng xem biến thể
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);

  // Slide-over Drawer (Thêm mới / Sửa)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [drawerTab, setDrawerTab] = useState<'basic' | 'variants' | 'media_specs'>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formBrandId, setFormBrandId] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [formBasePrice, setFormBasePrice] = useState<number>(0);
  const [formOriginalPrice, setFormOriginalPrice] = useState<number | undefined>(undefined);
  const [formFeatured, setFormFeatured] = useState(false);
  const [formIsFlashSale, setFormIsFlashSale] = useState(false);
  const [formBadge, setFormBadge] = useState('');
  const [formStatus, setFormStatus] = useState<'PUBLISHED' | 'DRAFT' | 'ARCHIVED'>('PUBLISHED');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formNewImageUrl, setFormNewImageUrl] = useState('');
  const [formSpecs, setFormSpecs] = useState<SpecFormItem[]>([]);
  const [formSkus, setFormSkus] = useState<SkuFormItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Modal Sửa Nhanh Tồn Kho SKU
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [skuStockEdits, setSkuStockEdits] = useState<{ [skuId: string]: { stock: number; price: number } }>({});
  const [isSavingStock, setIsSavingStock] = useState(false);

  // Nạp dữ liệu sản phẩm, danh mục, thương hiệu
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, catRes, brandRes] = await Promise.all([
        productService.getAdminProducts({ limit: 100 }),
        productService.getCategories(),
        productService.getBrands(),
      ]);
      setProducts(prodRes.products || []);
      setCategories(catRes || []);
      setBrands(brandRes || []);
    } catch (err: unknown) {
      console.error('Failed to fetch admin products:', err);
      setFeedbackMessage({ text: 'Lỗi nạp danh sách sản phẩm', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Lắng nghe phím ESC để đóng Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (stockModalProduct) setStockModalProduct(null);
        else if (drawerOpen) setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, stockModalProduct]);

  // Bộ lọc sản phẩm
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSlug = p.slug.toLowerCase().includes(q);
        const matchBrand = p.brand.toLowerCase().includes(q);
        const matchSku = p.variants.some((v) => v.sku.toLowerCase().includes(q));
        if (!matchName && !matchSlug && !matchBrand && !matchSku) return false;
      }
      return true;
    });
  }, [products, statusFilter, categoryFilter, searchQuery]);

  // Reset về trang 1 khi thay đổi bộ lọc hoặc số dòng/trang
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, searchQuery, pageSize]);

  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIndex, startIndex + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = products.length;
    const published = products.filter((p) => p.status === 'PUBLISHED').length;
    const draft = products.filter((p) => p.status === 'DRAFT').length;
    const lowStock = products.filter((p) => {
      const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0);
      return totalStock <= 5;
    }).length;
    return { total, published, draft, lowStock };
  }, [products]);

  // Mở Drawer tạo mới
  const handleOpenCreateDrawer = () => {
    setEditingProduct(null);
    setDrawerTab('basic');
    setFormName('');
    setFormSlug('');
    setFormCategoryId(categories[0]?.id || '');
    setFormBrandId(brands[0]?.id || '');
    setFormTagline('');
    setFormDescription('');
    setFormThumbnailUrl('');
    setFormBasePrice(0);
    setFormOriginalPrice(undefined);
    setFormFeatured(false);
    setFormIsFlashSale(false);
    setFormBadge('');
    setFormStatus('PUBLISHED');
    setFormImages([]);
    setFormNewImageUrl('');
    setFormSpecs([
      { label: 'Bảo hành', value: '12 tháng chính hãng' },
      { label: 'Xuất xứ', value: 'Chính hãng NovaTech' },
    ]);
    setFormSkus([
      {
        sku_code: `SKU-${Date.now().toString().slice(-6)}`,
        name: 'Bản Tiêu Chuẩn',
        color_name: 'Đen Không Gian',
        color_hex: '#1e293b',
        price: 0,
        stock_quantity: 10,
      },
    ]);
    setDrawerOpen(true);
  };

  // Mở Drawer chỉnh sửa
  const handleOpenEditDrawer = (prod: Product) => {
    setEditingProduct(prod);
    setDrawerTab('basic');
    setFormName(prod.name);
    setFormSlug(prod.slug);
    setFormCategoryId(prod.categoryId);
    setFormBrandId(brands.find((b) => b.name === prod.brand)?.id || '');
    setFormTagline(prod.tagline || '');
    setFormDescription(prod.description);
    setFormThumbnailUrl(prod.images[0] || '');
    setFormBasePrice(prod.basePrice);
    setFormOriginalPrice(prod.originalPrice);
    setFormFeatured(prod.featured);
    setFormIsFlashSale(prod.isFlashSale || false);
    setFormBadge(prod.badge || '');
    setFormStatus(prod.status || 'PUBLISHED');
    setFormImages(prod.images || []);
    setFormNewImageUrl('');
    setFormSpecs(prod.specs || []);
    setFormSkus(
      prod.variants.map((v) => ({
        id: v.id,
        sku_code: v.sku,
        name: v.name,
        color_name: v.colorName,
        color_hex: v.colorHex,
        price: v.price,
        original_price: v.originalPrice,
        stock_quantity: v.stock,
        image_url: v.image,
      })),
    );
    setDrawerOpen(true);
  };

  // Toggle trạng thái nhanh (PUBLISHED / ARCHIVED)
  const handleToggleStatus = async (prod: Product) => {
    const nextStatus = prod.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    try {
      const res = await productService.updateProductStatus(prod.id, nextStatus);
      if (res.success && res.product) {
        setProducts((prev) => prev.map((p) => (p.id === prod.id ? res.product! : p)));
        setFeedbackMessage({
          text: `Đã đổi trạng thái sản phẩm sang ${nextStatus === 'PUBLISHED' ? 'Đang bán' : 'Lưu kho'}`,
          type: 'success',
        });
      } else {
        setFeedbackMessage({ text: res.error || 'Lỗi khi cập nhật trạng thái', type: 'error' });
      }
    } catch {
      setFeedbackMessage({ text: 'Lỗi kết nối khi đổi trạng thái', type: 'error' });
    }
  };

  // Mở modal sửa nhanh kho SKU
  const handleOpenStockModal = (prod: Product) => {
    setStockModalProduct(prod);
    const initialEdits: { [skuId: string]: { stock: number; price: number } } = {};
    prod.variants.forEach((v) => {
      initialEdits[v.id] = { stock: v.stock, price: v.price };
    });
    setSkuStockEdits(initialEdits);
  };

  // Lưu sửa nhanh kho SKU
  const handleSaveStockEdits = async () => {
    if (!stockModalProduct) return;
    setIsSavingStock(true);
    try {
      for (const sku of stockModalProduct.variants) {
        const edit = skuStockEdits[sku.id];
        if (edit && (edit.stock !== sku.stock || edit.price !== sku.price)) {
          await productService.updateSkuStock(sku.id, edit.stock, edit.price);
        }
      }
      setFeedbackMessage({ text: 'Cập nhật kho và giá biến thể thành công', type: 'success' });
      setStockModalProduct(null);
      await fetchData();
    } catch {
      setFeedbackMessage({ text: 'Lỗi khi cập nhật tồn kho SKU', type: 'error' });
    } finally {
      setIsSavingStock(false);
    }
  };

  // Upload ảnh file (Option 2B)
  const handleUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>, targetField: 'thumbnail' | 'gallery') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await productService.uploadImage(file);
      if (res.success && res.url) {
        if (targetField === 'thumbnail') {
          setFormThumbnailUrl(res.url);
          if (!formImages.includes(res.url)) {
            setFormImages((prev) => [res.url!, ...prev]);
          }
        } else {
          setFormImages((prev) => [...prev, res.url!]);
        }
        setFeedbackMessage({ text: 'Tải ảnh lên thành công', type: 'success' });
      } else {
        setFeedbackMessage({ text: res.error || 'Tải ảnh lên thất bại', type: 'error' });
      }
    } catch {
      setFeedbackMessage({ text: 'Lỗi khi tải ảnh lên', type: 'error' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Submit Drawer Form (Tạo mới hoặc Sửa)
  const handleSubmitDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFeedbackMessage({ text: 'Vui lòng nhập tên sản phẩm', type: 'error' });
      return;
    }
    if (!formCategoryId) {
      setFeedbackMessage({ text: 'Vui lòng chọn danh mục sản phẩm', type: 'error' });
      return;
    }
    if (formBasePrice <= 0) {
      setFeedbackMessage({ text: 'Giá cơ bản phải lớn hơn 0', type: 'error' });
      return;
    }
    if (formSkus.length === 0) {
      setFeedbackMessage({ text: 'Sản phẩm phải có ít nhất 1 biến thể SKU', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const thumbnail = formThumbnailUrl.trim() || formImages[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
      const images = formImages.length > 0 ? formImages : [thumbnail];

      if (editingProduct) {
        // Cập nhật sản phẩm
        const updatePayload: UpdateProductInput = {
          name: formName.trim(),
          slug: formSlug.trim() || undefined,
          category_id: formCategoryId,
          brand_id: formBrandId || undefined,
          tagline: formTagline.trim() || undefined,
          description: formDescription.trim() || formName.trim(),
          thumbnail_url: thumbnail,
          base_price: Number(formBasePrice),
          original_price: formOriginalPrice ? Number(formOriginalPrice) : undefined,
          featured: formFeatured,
          is_flash_sale: formIsFlashSale,
          badge: formBadge.trim() || undefined,
          status: formStatus,
          images,
          specs: formSpecs.filter((s) => s.label.trim() && s.value.trim()),
        };

        const res = await productService.updateProduct(editingProduct.id, updatePayload);
        if (res.success && res.product) {
          setFeedbackMessage({ text: 'Cập nhật sản phẩm thành công', type: 'success' });
          setDrawerOpen(false);
          await fetchData();
        } else {
          setFeedbackMessage({ text: res.error || 'Cập nhật sản phẩm thất bại', type: 'error' });
        }
      } else {
        // Tạo mới sản phẩm
        const createPayload: CreateProductInput = {
          name: formName.trim(),
          slug: formSlug.trim() || undefined,
          category_id: formCategoryId,
          brand_id: formBrandId || undefined,
          tagline: formTagline.trim() || undefined,
          description: formDescription.trim() || formName.trim(),
          thumbnail_url: thumbnail,
          base_price: Number(formBasePrice),
          original_price: formOriginalPrice ? Number(formOriginalPrice) : undefined,
          featured: formFeatured,
          is_flash_sale: formIsFlashSale,
          badge: formBadge.trim() || undefined,
          status: formStatus,
          images,
          specs: formSpecs.filter((s) => s.label.trim() && s.value.trim()),
          variants: formSkus.map((sku) => ({
            sku_code: sku.sku_code.trim() || `SKU-${Date.now().toString().slice(-6)}`,
            name: sku.name.trim() || 'Mặc định',
            color_name: sku.color_name.trim() || 'Mặc định',
            color_hex: sku.color_hex.trim() || '#3b82f6',
            price: Number(sku.price) || Number(formBasePrice),
            original_price: sku.original_price ? Number(sku.original_price) : undefined,
            stock_quantity: Number(sku.stock_quantity) || 0,
            image_url: sku.image_url || undefined,
          })),
        };

        const res = await productService.createProduct(createPayload);
        if (res.success && res.product) {
          setFeedbackMessage({ text: 'Tạo sản phẩm mới thành công', type: 'success' });
          setDrawerOpen(false);
          await fetchData();
        } else {
          setFeedbackMessage({ text: res.error || 'Tạo sản phẩm thất bại', type: 'error' });
        }
      }
    } catch {
      setFeedbackMessage({ text: 'Lỗi kết nối khi lưu sản phẩm', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
  };

  const toggleExpandProduct = (id: string) => {
    setExpandedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 text-xs font-semibold backdrop-blur-md animate-in slide-in-from-top-2 duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="ml-2 hover:opacity-75 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Tiêu đề chuẩn AGENTS.md (Ngắn gọn, không icon trang trí, không subtext, không bọc Card) */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Quản Lý Sản Phẩm
        </h1>
        <button
          onClick={handleOpenCreateDrawer}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/25 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Thêm Sản Phẩm
        </button>
      </div>

      {/* 2. Thống kê nhanh (Metric Pills) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400">Tổng sản phẩm</span>
          <span className="text-2xl font-black text-white mt-2">{stats.total}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-400">Đang bán</span>
          <span className="text-2xl font-black text-emerald-300 mt-2">{stats.published}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-amber-400">Bản nháp</span>
          <span className="text-2xl font-black text-amber-300 mt-2">{stats.draft}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-rose-400">Tồn kho thấp (≤ 5)</span>
          <span className="text-2xl font-black text-rose-300 mt-2">{stats.lowStock}</span>
        </div>
      </div>

      {/* 3. Bộ lọc, tìm kiếm và nút làm mới */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        {/* Hàng 1: Tabs trạng thái & Nút Làm Mới */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: 'Tất Cả' },
                { id: 'PUBLISHED', label: 'Đang Bán' },
                { id: 'DRAFT', label: 'Bản Nháp' },
                { id: 'ARCHIVED', label: 'Lưu Kho' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {/* Hàng 2: Tìm kiếm & Lọc theo Danh mục */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên sản phẩm, slug, thương hiệu hoặc mã SKU..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="sm:w-64">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="all">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Bảng danh sách sản phẩm */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              <tr>
                <th className="py-3.5 px-4 w-10"></th>
                <th className="py-3.5 px-4">Sản Phẩm</th>
                <th className="py-3.5 px-4">Danh Mục & Hãng</th>
                <th className="py-3.5 px-4">Giá Cơ Bản</th>
                <th className="py-3.5 px-4">Biến Thể & Kho</th>
                <th className="py-3.5 px-4">Trạng Thái</th>
                <th className="py-3.5 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-2" />
                    <p className="text-xs font-medium">Đang tải dữ liệu sản phẩm...</p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Package className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-xs font-semibold">Không tìm thấy sản phẩm nào phù hợp</p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const isExpanded = expandedProductIds.includes(p.id);
                  const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0);

                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-slate-800/40 transition-colors">
                        {/* Nút mở rộng xem biến thể */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => toggleExpandProduct(p.id)}
                            className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title={isExpanded ? 'Thu gọn' : 'Xem biến thể SKU'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Sản phẩm (Ảnh & Tên) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700/60 overflow-hidden shrink-0 flex items-center justify-center">
                              {p.images[0] ? (
                                <img
                                  src={p.images[0]}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-500" />
                              )}
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <span className="font-bold text-white block truncate">{p.name}</span>
                              <span className="text-[11px] text-slate-500 font-mono block truncate">
                                /{p.slug}
                              </span>
                              {p.badge && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                  {p.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Danh Mục & Hãng */}
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-200 block">
                            {p.categoryName || 'Chưa gán'}
                          </span>
                          <span className="text-[11px] text-slate-500 block">{p.brand}</span>
                        </td>

                        {/* Giá Cơ Bản */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-white block">
                            {formatPrice(p.basePrice)}
                          </span>
                          {p.originalPrice && p.originalPrice > p.basePrice && (
                            <span className="text-[10px] text-slate-500 line-through block">
                              {formatPrice(p.originalPrice)}
                            </span>
                          )}
                        </td>

                        {/* Biến Thể & Tồn Kho */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-200">
                              {p.variants.length} SKU
                            </span>
                            <span className="text-slate-500">•</span>
                            <span
                              className={`font-semibold ${
                                totalStock === 0
                                  ? 'text-rose-400'
                                  : totalStock <= 5
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                              }`}
                            >
                              {totalStock} trong kho
                            </span>
                          </div>
                          {/* Mini color preview chips */}
                          <div className="flex items-center gap-1 mt-1">
                            {p.variants.slice(0, 4).map((v) => (
                              <span
                                key={v.id}
                                className="w-2.5 h-2.5 rounded-full border border-slate-700 shadow-xs"
                                style={{ backgroundColor: v.colorHex }}
                                title={`${v.name} (${v.colorName})`}
                              />
                            ))}
                            {p.variants.length > 4 && (
                              <span className="text-[10px] text-slate-500">
                                +{p.variants.length - 4}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Trạng Thái */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              p.status === 'PUBLISHED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : p.status === 'DRAFT'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.status === 'PUBLISHED'
                                  ? 'bg-emerald-400'
                                  : p.status === 'DRAFT'
                                    ? 'bg-amber-400'
                                    : 'bg-slate-400'
                              }`}
                            />
                            {p.status === 'PUBLISHED'
                              ? 'Đang bán'
                              : p.status === 'DRAFT'
                                ? 'Bản nháp'
                                : 'Lưu kho'}
                          </span>
                        </td>

                        {/* Thao Tác (Icon-only buttons with custom top tooltips) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Nút sửa nhanh tồn kho SKU */}
                            <Tooltip content="Sửa tồn kho & giá SKU">
                              <button
                                onClick={() => handleOpenStockModal(p)}
                                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
                              >
                                <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                              </button>
                            </Tooltip>

                            {/* Nút bật/tắt bán */}
                            <Tooltip
                              content={p.status === 'PUBLISHED' ? 'Chuyển sang Lưu kho' : 'Kích hoạt Đang bán'}
                            >
                              <button
                                onClick={() => handleToggleStatus(p)}
                                className={`p-2 rounded-lg transition-all cursor-pointer active:scale-95 ${
                                  p.status === 'PUBLISHED'
                                    ? 'bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400'
                                    : 'bg-slate-800/80 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-400'
                                }`}
                              >
                                {p.status === 'PUBLISHED' ? (
                                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                            </Tooltip>

                            {/* Nút chỉnh sửa toàn bộ */}
                            <Tooltip content="Chỉnh sửa chi tiết">
                              <button
                                onClick={() => handleOpenEditDrawer(p)}
                                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>

                      {/* Dòng mở rộng: Danh sách biến thể SKU */}
                      {isExpanded && (
                        <tr className="bg-slate-950/50">
                          <td colSpan={7} className="p-4 pl-14">
                            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/90">
                              <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                  Danh Sách Biến Thể SKU ({p.variants.length})
                                </span>
                                <button
                                  onClick={() => handleOpenStockModal(p)}
                                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                                >
                                  <Boxes className="w-3 h-3" /> Chỉnh sửa tồn kho
                                </button>
                              </div>
                              <table className="w-full text-[11px]">
                                <thead className="text-slate-400 border-b border-slate-800/50">
                                  <tr>
                                    <th className="py-2 px-3 text-left">Mã SKU</th>
                                    <th className="py-2 px-3 text-left">Tên Biến Thể</th>
                                    <th className="py-2 px-3 text-left">Màu Sắc</th>
                                    <th className="py-2 px-3 text-left">Giá Bán</th>
                                    <th className="py-2 px-3 text-left">Tồn Kho</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40">
                                  {p.variants.map((v) => (
                                    <tr key={v.id} className="hover:bg-slate-800/20">
                                      <td className="py-2 px-3 font-mono text-slate-400">
                                        {v.sku}
                                      </td>
                                      <td className="py-2 px-3 font-medium text-slate-200">
                                        {v.name}
                                      </td>
                                      <td className="py-2 px-3">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className="w-3 h-3 rounded-full border border-slate-700"
                                            style={{ backgroundColor: v.colorHex }}
                                          />
                                          <span className="text-slate-300">{v.colorName}</span>
                                        </div>
                                      </td>
                                      <td className="py-2 px-3 font-semibold text-slate-200">
                                        {formatPrice(v.price)}
                                      </td>
                                      <td className="py-2 px-3">
                                        <span
                                          className={`font-bold ${
                                            v.stock === 0
                                              ? 'text-rose-400'
                                              : v.stock <= 5
                                                ? 'text-amber-400'
                                                : 'text-emerald-400'
                                          }`}
                                        >
                                          {v.stock}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4.1 Thanh điều khiển phân trang */}
        {!isLoading && totalItems > 0 && (
          <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 text-slate-400">
              <span>
                Hiển thị <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong> - <strong className="text-white">{Math.min(currentPage * pageSize, totalItems)}</strong> trên tổng số <strong className="text-white">{totalItems}</strong> sản phẩm
              </span>
              <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
                <span>Số dòng:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  <option value={5}>5 / trang</option>
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Trước
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="px-1 text-slate-600">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            currentPage === p
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                Sau <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Slide-over Drawer Thêm Mới / Sửa Sản Phẩm (Option 1A) */}
      <ResizableDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        storageKey="admin_drawer_width"
        defaultWidth={880}
        title={editingProduct ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
        subtitle={editingProduct ? editingProduct.name : 'Nhập thông tin chi tiết và biến thể SKU'}
        headerBottom={
          <div className="flex px-6 bg-slate-950/30">
            <button
              type="button"
              onClick={() => setDrawerTab('basic')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                drawerTab === 'basic'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Thông Tin Cơ Bản
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab('variants')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                drawerTab === 'variants'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Biến Thể SKU ({formSkus.length})
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab('media_specs')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                drawerTab === 'media_specs'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Hình Ảnh & Thông Số
            </button>
          </div>
        }
        bodyClassName="p-0 flex flex-col"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              form="product-edit-form"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{editingProduct ? 'Cập Nhật Sản Phẩm' : 'Tạo Sản Phẩm'}</span>
            </button>
          </div>
        }
      >
        <form id="product-edit-form" onSubmit={handleSubmitDrawer} className="p-6 space-y-6 flex-1">
              {/* TAB 1: THÔNG TIN CƠ BẢN */}
              {drawerTab === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      Tên sản phẩm *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        if (!editingProduct) {
                          setFormSlug(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, '-')
                              .replace(/(^-|-$)+/g, ''),
                          );
                        }
                      }}
                      placeholder="VD: Tai nghe Nova Sound Pro LDAC"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        Đường dẫn (Slug)
                      </label>
                      <input
                        type="text"
                        value={formSlug}
                        onChange={(e) => setFormSlug(e.target.value)}
                        placeholder="VD: nova-sound-pro-ldac"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        Huy hiệu (Badge)
                      </label>
                      <input
                        type="text"
                        value={formBadge}
                        onChange={(e) => setFormBadge(e.target.value)}
                        placeholder="VD: FLAGSHIP, MỚI RA MẮT"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        Danh mục *
                      </label>
                      <select
                        value={formCategoryId}
                        onChange={(e) => setFormCategoryId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 transition-colors cursor-pointer"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        Thương hiệu
                      </label>
                      <select
                        value={formBrandId}
                        onChange={(e) => setFormBrandId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 transition-colors cursor-pointer"
                      >
                        <option value="">Mặc định (NOVA TECH)</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        Giá bán cơ bản (VND) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        required
                        value={formBasePrice}
                        onChange={(e) => setFormBasePrice(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        Giá gốc so sánh (VND)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={formOriginalPrice || ''}
                        onChange={(e) =>
                          setFormOriginalPrice(e.target.value ? Number(e.target.value) : undefined)
                        }
                        placeholder="Để trống nếu không giảm giá"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      Khẩu hiệu ngắn (Tagline)
                    </label>
                    <input
                      type="text"
                      value={formTagline}
                      onChange={(e) => setFormTagline(e.target.value)}
                      placeholder="VD: Chuẩn âm thanh Hi-Res Audio không dây cao cấp"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      Mô tả chi tiết sản phẩm
                    </label>
                    <textarea
                      rows={4}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Nhập thông tin giới thiệu, tính năng nổi bật..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:bg-slate-800/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={formFeatured}
                        onChange={(e) => setFormFeatured(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">Sản phẩm Nổi bật</span>
                        <span className="text-[10px] text-slate-500 block">Ưu tiên hiển thị trang chủ</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:bg-slate-800/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={formIsFlashSale}
                        onChange={(e) => setFormIsFlashSale(e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-rose-400 block">Flash Sale</span>
                        <span className="text-[10px] text-slate-500 block">Đưa vào danh mục giá sốc</span>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      Trạng thái xuất bản
                    </label>
                    <div className="flex gap-2">
                      {(
                        [
                          { id: 'PUBLISHED', label: 'Đang bán' },
                          { id: 'DRAFT', label: 'Bản nháp' },
                          { id: 'ARCHIVED', label: 'Lưu kho' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setFormStatus(st.id)}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            formStatus === st.id
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BIẾN THỂ SKU */}
              {drawerTab === 'variants' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">Quản lý các biến thể màu sắc & SKU</span>
                      <span className="text-[11px] text-slate-400">
                        Mỗi biến thể có mã SKU, màu sắc và tồn kho riêng
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormSkus((prev) => [
                          ...prev,
                          {
                            sku_code: `SKU-${Date.now().toString().slice(-6)}`,
                            name: `Biến thể ${prev.length + 1}`,
                            color_name: 'Bạc Titan',
                            color_hex: '#94a3b8',
                            price: formBasePrice,
                            stock_quantity: 10,
                          },
                        ]);
                      }}
                      className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm Biến Thể
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formSkus.map((sku, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <span className="text-xs font-bold text-indigo-400">
                            Biến thể #{idx + 1}
                          </span>
                          {formSkus.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setFormSkus((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Xóa biến thể này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                              Mã SKU *
                            </label>
                            <input
                              type="text"
                              required
                              value={sku.sku_code}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormSkus((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, sku_code: val } : s)),
                                );
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                              Tên hiển thị biến thể *
                            </label>
                            <input
                              type="text"
                              required
                              value={sku.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormSkus((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, name: val } : s)),
                                );
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                              Tên màu sắc *
                            </label>
                            <input
                              type="text"
                              required
                              value={sku.color_name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormSkus((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, color_name: val } : s)),
                                );
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                              Mã màu HEX *
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={sku.color_hex}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormSkus((prev) =>
                                    prev.map((s, i) => (i === idx ? { ...s, color_hex: val } : s)),
                                  );
                                }}
                                className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer shrink-0"
                              />
                              <input
                                type="text"
                                value={sku.color_hex}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormSkus((prev) =>
                                    prev.map((s, i) => (i === idx ? { ...s, color_hex: val } : s)),
                                  );
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                              Số lượng tồn *
                            </label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={sku.stock_quantity}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setFormSkus((prev) =>
                                  prev.map((s, i) =>
                                    i === idx ? { ...s, stock_quantity: val } : s,
                                  ),
                                );
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                            Giá bán riêng của biến thể (VND)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            required
                            value={sku.price}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setFormSkus((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, price: val } : s)),
                              );
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-hidden focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: HÌNH ẢNH & THÔNG SỐ (Option 2B Upload File) */}
              {drawerTab === 'media_specs' && (
                <div className="space-y-6">
                  {/* Quản lý hình ảnh */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-white block">Thư Viện Hình Ảnh</span>

                    {/* Hộp tải file ảnh lên (Option 2B) */}
                    <div className="border border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 bg-slate-950/40 text-center transition-colors">
                      <UploadCloud className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-200">
                        Tải ảnh từ máy tính (JPG, PNG, WEBP, tối đa 10MB)
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Ảnh sẽ tự động lưu vào hệ thống và hiển thị trực tiếp
                      </p>

                      <label className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer">
                        {isUploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="w-3.5 h-3.5" />
                        )}
                        <span>{isUploading ? 'Đang tải lên...' : 'Chọn file ảnh để tải lên'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploading}
                          onChange={(e) => handleUploadImageFile(e, 'gallery')}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Hoặc thêm bằng link URL */}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={formNewImageUrl}
                        onChange={(e) => setFormNewImageUrl(e.target.value)}
                        placeholder="Hoặc dán URL hình ảnh (VD: https://images.unsplash.com/...)"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (formNewImageUrl.trim()) {
                            setFormImages((prev) => [...prev, formNewImageUrl.trim()]);
                            setFormNewImageUrl('');
                          }
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Thêm Link
                      </button>
                    </div>

                    {/* Preview danh sách ảnh */}
                    {formImages.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 pt-2">
                        {formImages.map((img, idx) => (
                          <div
                            key={idx}
                            className={`relative group rounded-xl overflow-hidden border bg-slate-950 aspect-square ${
                              idx === 0
                                ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                                : 'border-slate-800'
                            }`}
                          >
                            <img
                              src={img}
                              alt={`Ảnh ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {idx === 0 && (
                              <span className="absolute top-1 left-1 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                Ảnh chính
                              </span>
                            )}
                            <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                              {idx !== 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormImages((prev) => [
                                      img,
                                      ...prev.filter((_, i) => i !== idx),
                                    ]);
                                  }}
                                  className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white text-[10px] cursor-pointer"
                                  title="Đặt làm ảnh chính"
                                >
                                  Chính
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setFormImages((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="p-1 rounded bg-rose-950 text-rose-400 hover:text-rose-200 cursor-pointer"
                                title="Xóa ảnh này"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Thông số kỹ thuật */}
                  <div className="space-y-3 pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white block">Thông Số Kỹ Thuật</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormSpecs((prev) => [...prev, { label: '', value: '' }])
                        }
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Thêm Thông Số
                      </button>
                    </div>

                    <div className="space-y-2">
                      {formSpecs.map((spec, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={spec.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormSpecs((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, label: val } : s)),
                              );
                            }}
                            placeholder="Thuộc tính (VD: Pin, Trọng lượng)"
                            className="w-1/3 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                          />
                          <input
                            type="text"
                            value={spec.value}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormSpecs((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, value: val } : s)),
                              );
                            }}
                            placeholder="Giá trị (VD: 50 Giờ, 250g)"
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setFormSpecs((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

        </form>
      </ResizableDrawer>

      {/* 6. Modal Sửa Nhanh Tồn Kho & Giá SKU */}
      {stockModalProduct && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs"
            onClick={() => setStockModalProduct(null)}
          />
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-base font-black text-white block">Sửa Nhanh Tồn Kho SKU</span>
                <span className="text-xs text-slate-400">{stockModalProduct.name}</span>
              </div>
              <button
                onClick={() => setStockModalProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {stockModalProduct.variants.map((v) => {
                const currentEdit = skuStockEdits[v.id] || { stock: v.stock, price: v.price };
                return (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full border border-slate-700"
                          style={{ backgroundColor: v.colorHex }}
                        />
                        <span className="text-xs font-bold text-white">{v.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">{v.sku}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Số lượng tồn kho
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={currentEdit.stock}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSkuStockEdits((prev) => ({
                              ...prev,
                              [v.id]: { ...prev[v.id]!, stock: val },
                            }));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Giá bán (VND)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={currentEdit.price}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSkuStockEdits((prev) => ({
                              ...prev,
                              [v.id]: { ...prev[v.id]!, price: val },
                            }));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStockModalProduct(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveStockEdits}
                disabled={isSavingStock}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95"
              >
                {isSavingStock ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Lưu Thay Đổi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
