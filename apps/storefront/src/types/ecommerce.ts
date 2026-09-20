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

export interface ApiCartStoredItem {
  sku_id: string;
  product_id?: string;
  product_name?: string;
  product_slug?: string;
  variant_name?: string;
  color_name?: string;
  price: number;
  original_price?: number;
  image?: string;
  quantity: number;
  max_stock: number;
  added_at: string;
}

export interface ApiCartDto {
  cart_key: string;
  items: ApiCartStoredItem[];
  item_count: number;
  subtotal_amount: number;
}

export interface ApiOrderItemDto {
  id: string;
  sku_id: string;
  product_id: string;
  product_name: string;
  sku_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  thumbnail_url?: string;
}

export interface ApiOrderDto {
  id: string;
  order_code: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  shipping_address_json: string;
  subtotal_amount: number;
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  voucher_code?: string;
  cancel_reason?: string;
  note?: string;
  items: ApiOrderItemDto[];
  created_at: string;
}

export interface CreateOrderPayload {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  shipping_address_json: string;
  payment_method: string;
  voucher_code?: string;
  note?: string;
  items: {
    sku_id: string;
    quantity: number;
  }[];
}
