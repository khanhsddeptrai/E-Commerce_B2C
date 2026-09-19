import * as path from 'path';
import * as fs from 'fs';
import { Observable } from 'rxjs';

function getProtoPath(filename: string): string {
  let baseDir = '';
  try {
    // @ts-ignore
    baseDir = __dirname;
  } catch {
    // @ts-ignore
    baseDir = import.meta.dirname || '';
  }

  const candidates = [
    path.resolve(baseDir, filename),
    path.resolve(baseDir, '../src', filename),
    path.resolve(process.cwd(), 'packages/proto/src', filename),
    path.resolve(process.cwd(), '../packages/proto/src', filename),
    path.resolve(process.cwd(), '../../packages/proto/src', filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export const AUTH_PROTO_PATH = getProtoPath('auth.proto');
export const AUTH_PACKAGE_NAME = 'auth';

export interface UserDto {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: string;
  status: string;
  created_at: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_info?: string;
}

export interface AuthResponse {
  user: UserDto;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ValidateTokenRequest {
  access_token: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  user_id: string;
  email: string;
  role: string;
  error?: string;
}

export interface GetProfileRequest {
  user_id: string;
}

export interface UserProfileResponse {
  user: UserDto;
}

export interface AuthServiceClient {
  register(request: RegisterRequest): Observable<AuthResponse>;
  login(request: LoginRequest): Observable<AuthResponse>;
  refreshToken(request: RefreshTokenRequest): Observable<TokenResponse>;
  validateToken(request: ValidateTokenRequest): Observable<ValidateTokenResponse>;
  getProfile(request: GetProfileRequest): Observable<UserProfileResponse>;
}

export const PRODUCT_PROTO_PATH = getProtoPath('product.proto');
export const PRODUCT_PACKAGE_NAME = 'product';

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image_url?: string;
  item_count: number;
}

export interface ProductSkuDto {
  id: string;
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

export interface ProductSpecDto {
  label: string;
  value: string;
}

export interface ProductDto {
  id: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  brand: string;
  name: string;
  slug: string;
  tagline?: string;
  description: string;
  thumbnail_url: string;
  base_price: number;
  original_price?: number;
  featured: boolean;
  is_flash_sale: boolean;
  flash_sale_sold: number;
  flash_sale_total: number;
  rating: number;
  review_count: number;
  badge?: string;
  images: string[];
  specs: ProductSpecDto[];
  variants: ProductSkuDto[];
  created_at: string;
}

export interface GetProductsRequest {
  category_slug?: string;
  search_query?: string;
  min_price?: number;
  max_price?: number;
  sort_by?: string;
  page?: number;
  limit?: number;
  featured_only?: boolean;
  flash_sale_only?: boolean;
}

export interface GetProductsResponse {
  products: ProductDto[];
  total: number;
  page: number;
  limit: number;
}

export interface GetProductBySlugRequest {
  slug: string;
}

export interface GetProductBySlugResponse {
  product: ProductDto;
}

export interface GetCategoriesRequest {}

export interface GetCategoriesResponse {
  categories: CategoryDto[];
}

export interface ProductServiceClient {
  getProducts(request: GetProductsRequest): Observable<GetProductsResponse>;
  getProductBySlug(request: GetProductBySlugRequest): Observable<GetProductBySlugResponse>;
  getCategories(request: GetCategoriesRequest): Observable<GetCategoriesResponse>;
}

