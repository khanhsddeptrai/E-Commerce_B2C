import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductSpecInputDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class CreateSkuDto {
  @IsString()
  @IsNotEmpty()
  sku_code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  color_name!: string;

  @IsString()
  @IsNotEmpty()
  color_hex!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  original_price?: number;

  @IsNumber()
  @Min(0)
  stock_quantity!: number;

  @IsString()
  @IsOptional()
  image_url?: string;

  @IsString()
  @IsOptional()
  specs_json?: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsNotEmpty()
  category_id!: string;

  @IsString()
  @IsOptional()
  brand_id?: string;

  @IsString()
  @IsOptional()
  tagline?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  thumbnail_url!: string;

  @IsNumber()
  @Min(0)
  base_price!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  original_price?: number;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsBoolean()
  @IsOptional()
  is_flash_sale?: boolean;

  @IsString()
  @IsOptional()
  badge?: string;

  @IsString()
  @IsOptional()
  @IsIn(['PUBLISHED', 'DRAFT', 'ARCHIVED'])
  status?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSpecInputDto)
  @IsOptional()
  specs?: ProductSpecInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSkuDto)
  @IsOptional()
  variants?: CreateSkuDto[];
}

export class UpdateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsNotEmpty()
  category_id!: string;

  @IsString()
  @IsOptional()
  brand_id?: string;

  @IsString()
  @IsOptional()
  tagline?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  thumbnail_url!: string;

  @IsNumber()
  @Min(0)
  base_price!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  original_price?: number;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsBoolean()
  @IsOptional()
  is_flash_sale?: boolean;

  @IsString()
  @IsOptional()
  badge?: string;

  @IsString()
  @IsOptional()
  @IsIn(['PUBLISHED', 'DRAFT', 'ARCHIVED'])
  status?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSpecInputDto)
  @IsOptional()
  specs?: ProductSpecInputDto[];
}

export class UpdateProductStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['PUBLISHED', 'DRAFT', 'ARCHIVED'])
  status!: string;
}

export class UpdateSkuStockDto {
  @IsNumber()
  @Min(0)
  stock_quantity!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;
}
