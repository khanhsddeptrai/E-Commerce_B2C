import {
  Product,
  Category,
  FilterState,
  ApiProductDto,
  ApiCategoryDto,
  ApiProductSkuDto,
  Brand,
  CreateProductInput,
  UpdateProductInput,
} from "@/types/ecommerce";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8000/api/v1";

function mapApiProductToProduct(api: ApiProductDto): Product {
  return {
    id: api.id,
    slug: api.slug,
    name: api.name,
    tagline: api.tagline || "",
    description: api.description,
    categoryId: api.category_id || api.categoryId || "",
    categoryName: api.category_name || api.categoryName || "",
    brand: api.brand || "NOVA TECH",
    badge: api.badge,
    featured: Boolean(api.featured),
    isFlashSale: Boolean(api.is_flash_sale ?? api.isFlashSale),
    flashSaleSold: api.flash_sale_sold ?? api.flashSaleSold ?? 0,
    flashSaleTotal: api.flash_sale_total ?? api.flashSaleTotal ?? 0,
    basePrice: Number(api.base_price ?? api.basePrice ?? 0),
    originalPrice: api.original_price ?? api.originalPrice ? Number(api.original_price ?? api.originalPrice) : undefined,
    rating: Number(api.rating ?? 5.0),
    reviewCount: Number(api.review_count ?? api.reviewCount ?? 0),
    images: api.images || [],
    specs: api.specs || [],
    variants: (api.variants || []).map((v: ApiProductSkuDto) => ({
      id: v.id,
      sku: v.sku_code || v.sku || "",
      name: v.name,
      colorName: v.color_name || v.colorName || "",
      colorHex: v.color_hex || v.colorHex || "#000000",
      specs: typeof v.specs_json === "string" ? JSON.parse(v.specs_json || "{}") : v.specs || {},
      price: Number(v.price),
      originalPrice: v.original_price ?? v.originalPrice ? Number(v.original_price ?? v.originalPrice) : undefined,
      stock: Number(v.stock_quantity ?? v.stock ?? 0),
      image: v.image_url || v.image || "",
    })),
    createdAt: api.created_at || api.createdAt || new Date().toISOString(),
    status: api.status || 'PUBLISHED',
  };
}

function mapApiCategoryToCategory(api: ApiCategoryDto): Category {
  return {
    id: api.id,
    slug: api.slug,
    name: api.name,
    description: api.description || "",
    icon: api.icon || "Package",
    itemCount: Number(api.item_count ?? api.itemCount ?? 0),
    featuredImage: api.image_url || api.featuredImage || "",
  };
}

export const productService = {
  async getProducts(filters?: FilterState): Promise<{ products: Product[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (filters?.category && filters.category !== "all") params.set("category", filters.category);
      if (filters?.searchQuery?.trim()) params.set("search", filters.searchQuery.trim());
      if (filters?.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
      if (filters?.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
      if (filters?.sortBy) params.set("sortBy", filters.sortBy);
      params.set("limit", "50");

      const res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
        next: { revalidate: 30 },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.products)) {
          return {
            products: data.products.map(mapApiProductToProduct),
            total: data.total || data.products.length,
          };
        }
      }
    } catch (err: unknown) {
      console.error("[productService.getProducts] Error fetching products:", err);
    }

    return {
      products: [],
      total: 0,
    };
  },

  async getProductBySlug(slug: string): Promise<Product | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(slug)}`, {
        next: { revalidate: 30 },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          return mapApiProductToProduct(data);
        }
      }
    } catch (err: unknown) {
      console.error("[productService.getProductBySlug] Error fetching product:", err);
    }
    return null;
  },

  async getFeaturedProducts(limit = 4): Promise<Product[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/products?featured=true&limit=${limit}`, {
        next: { revalidate: 30 },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.products)) {
          return data.products.map(mapApiProductToProduct);
        }
      }
    } catch (err: unknown) {
      console.error("[productService.getFeaturedProducts] Error:", err);
    }
    return [];
  },

  async getFlashSaleProducts(): Promise<Product[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/products?flashSale=true`, {
        next: { revalidate: 30 },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.products)) {
          return data.products.map(mapApiProductToProduct);
        }
      }
    } catch (err: unknown) {
      console.error("[productService.getFlashSaleProducts] Error:", err);
    }
    return [];
  },

  async getCategories(): Promise<Category[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/categories`, {
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : data.categories || [];
        return rawList.map(mapApiCategoryToCategory);
      }
    } catch (err: unknown) {
      console.error("[productService.getCategories] Error:", err);
    }
    return [];
  },

  async getRelatedProducts(productId: string, categoryId: string, limit = 4): Promise<Product[]> {
    try {
      const params = new URLSearchParams();
      if (categoryId) params.set("category", categoryId);
      params.set("limit", String(limit + 2));

      const res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
        next: { revalidate: 30 },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.products)) {
          return data.products
            .map(mapApiProductToProduct)
            .filter((p: Product) => p.id !== productId)
            .slice(0, limit);
        }
      }
    } catch (err: unknown) {
      console.error("[productService.getRelatedProducts] Error:", err);
    }
    return [];
  },

  // --- ADMIN API CLIENT METHODS ---

  async getAdminProducts(params?: {
    category?: string;
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
    try {
      const q = new URLSearchParams();
      if (params?.category && params.category !== 'all') q.set('category', params.category);
      if (params?.search?.trim()) q.set('search', params.search.trim());
      if (params?.status && params.status !== 'ALL') q.set('status', params.status);
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));

      const res = await fetch(`${API_BASE_URL}/admin/products?${q.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        return {
          products: (data.products || []).map(mapApiProductToProduct),
          total: data.total || 0,
          page: data.page || 1,
          limit: data.limit || 20,
        };
      }
    } catch (err: unknown) {
      console.error('[productService.getAdminProducts] Error:', err);
    }
    return { products: [], total: 0, page: 1, limit: 20 };
  },

  async getBrands(): Promise<Brand[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/brands`, {
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.brands)) return data.brands;
      }
    } catch (err: unknown) {
      console.error('[productService.getBrands] Error:', err);
    }
    return [];
  },

  async createProduct(input: CreateProductInput): Promise<{ success: boolean; product?: Product; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/products`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data?.message || 'Không thể tạo sản phẩm' };
      }
      return { success: true, product: mapApiProductToProduct(data) };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối khi tạo sản phẩm';
      return { success: false, error: msg };
    }
  },

  async updateProduct(id: string, input: UpdateProductInput): Promise<{ success: boolean; product?: Product; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data?.message || 'Không thể cập nhật sản phẩm' };
      }
      return { success: true, product: mapApiProductToProduct(data) };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối khi cập nhật sản phẩm';
      return { success: false, error: msg };
    }
  },

  async updateProductStatus(
    id: string,
    status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED',
  ): Promise<{ success: boolean; product?: Product; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/products/${id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data?.message || 'Không thể cập nhật trạng thái' };
      }
      return { success: true, product: mapApiProductToProduct(data) };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối khi cập nhật trạng thái';
      return { success: false, error: msg };
    }
  },

  async updateSkuStock(
    skuId: string,
    stockQuantity: number,
    price?: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const body: { stock_quantity: number; price?: number } = { stock_quantity: stockQuantity };
      if (price !== undefined) body.price = price;

      const res = await fetch(`${API_BASE_URL}/admin/products/skus/${skuId}/stock`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data?.message || 'Không thể cập nhật tồn kho SKU' };
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối khi cập nhật tồn kho SKU';
      return { success: false, error: msg };
    }
  },

  async uploadImage(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data?.error || 'Tải ảnh lên thất bại' };
      }
      return { success: true, url: data.url };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải ảnh lên';
      return { success: false, error: msg };
    }
  },
};

