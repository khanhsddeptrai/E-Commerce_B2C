import { Product, Category, FilterState } from "@/types/ecommerce";
import { MOCK_PRODUCTS } from "@/mock/products";
import { MOCK_CATEGORIES } from "@/mock/categories";

const SIMULATED_DELAY_MS = 150;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const productService = {
  async getProducts(filters?: FilterState): Promise<{ products: Product[]; total: number }> {
    await delay(SIMULATED_DELAY_MS);

    let list = [...MOCK_PRODUCTS];

    if (filters?.category) {
      list = list.filter(
        (p) => p.categoryId === filters.category || p.categoryName.toLowerCase().includes(filters.category!.toLowerCase())
      );
    }

    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      );
    }

    if (filters?.minPrice !== undefined) {
      list = list.filter((p) => p.basePrice >= filters.minPrice!);
    }

    if (filters?.maxPrice !== undefined) {
      list = list.filter((p) => p.basePrice <= filters.maxPrice!);
    }

    if (filters?.sortBy) {
      switch (filters.sortBy) {
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
    }

    return {
      products: list,
      total: list.length,
    };
  },

  async getProductBySlug(slug: string): Promise<Product | null> {
    await delay(SIMULATED_DELAY_MS);
    const item = MOCK_PRODUCTS.find((p) => p.slug === slug);
    return item || null;
  },

  async getFeaturedProducts(): Promise<Product[]> {
    await delay(SIMULATED_DELAY_MS);
    return MOCK_PRODUCTS.filter((p) => p.featured);
  },

  async getFlashSaleProducts(): Promise<Product[]> {
    await delay(SIMULATED_DELAY_MS);
    return MOCK_PRODUCTS.filter((p) => p.isFlashSale);
  },

  async getCategories(): Promise<Category[]> {
    await delay(SIMULATED_DELAY_MS);
    return MOCK_CATEGORIES;
  },

  async getRelatedProducts(productId: string, categoryId: string, limit = 4): Promise<Product[]> {
    await delay(SIMULATED_DELAY_MS);
    return MOCK_PRODUCTS.filter((p) => p.id !== productId && p.categoryId === categoryId).slice(0, limit);
  },
};
