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

// ==========================================
// Backend API Gateway / gRPC DTO Responses
// ==========================================
export interface ApiProductSpecDto {
  label: string;
  value: string;
}

export interface ApiProductSkuDto {
  id: string;
  sku_code?: string;
  sku?: string;
  name: string;
  color_name?: string;
  colorName?: string;
  color_hex?: string;
  colorHex?: string;
  price: number | string;
  original_price?: number | string;
  originalPrice?: number | string;
  stock_quantity?: number;
  stock?: number;
  image_url?: string;
  image?: string;
  specs_json?: string;
  specs?: Record<string, string>;
}

export interface ApiProductDto {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  category_id?: string;
  categoryId?: string;
  category_name?: string;
  categoryName?: string;
  category_slug?: string;
  brand?: string;
  badge?: string;
  featured?: boolean;
  is_flash_sale?: boolean;
  isFlashSale?: boolean;
  flash_sale_sold?: number;
  flashSaleSold?: number;
  flash_sale_total?: number;
  flashSaleTotal?: number;
  base_price?: number | string;
  basePrice?: number | string;
  original_price?: number | string;
  originalPrice?: number | string;
  rating?: number | string;
  review_count?: number;
  reviewCount?: number;
  images?: string[];
  specs?: ApiProductSpecDto[];
  variants?: ApiProductSkuDto[];
  created_at?: string;
  createdAt?: string;
}

export interface ApiCategoryDto {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  item_count?: number;
  itemCount?: number;
  image_url?: string;
  featuredImage?: string;
}
