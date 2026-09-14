export interface ProductVariant {
  id: string;
  sku: string;
  name: string; // e.g. "Space Black - 512GB"
  colorName: string;
  colorHex: string;
  specs: Record<string, string>; // e.g. { "Bộ nhớ": "512GB", "Kết nối": "Bluetooth 5.4" }
  price: number;
  originalPrice?: number;
  stock: number;
  image: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  categoryId: string;
  categoryName: string;
  brand: string;
  badge?: string; // e.g. "MỚI RA MẮT", "BÁN CHẠY", "FLASH SALE"
  featured: boolean;
  isFlashSale?: boolean;
  flashSaleSold?: number;
  flashSaleTotal?: number;
  basePrice: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  images: string[];
  specs: {
    label: string;
    value: string;
  }[];
  variants: ProductVariant[];
  createdAt: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  itemCount: number;
  featuredImage: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string;
  variantName: string;
  colorName: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity: number;
  maxStock: number;
}

export interface Review {
  id: string;
  author: string;
  avatar?: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
  variantBought?: string;
}

export interface FilterState {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  searchQuery?: string;
  sortBy?: "featured" | "price-asc" | "price-desc" | "rating" | "newest";
  brand?: string;
}
