import {
  Product,
  Category,
  FilterState,
  ApiProductDto,
  ApiCategoryDto,
  ApiProductSkuDto,
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
        if (Array.isArray(data)) {
          return data.map(mapApiCategoryToCategory);
        }
      }
    } catch (err) {
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
    } catch (err) {
      console.error("[productService.getRelatedProducts] Error:", err);
    }
    return [];
  },
};
