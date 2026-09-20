import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  sku_id!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity: number = 1;

  @IsString()
  @IsOptional()
  product_id?: string;

  @IsString()
  @IsOptional()
  product_name?: string;

  @IsString()
  @IsOptional()
  product_slug?: string;

  @IsString()
  @IsOptional()
  variant_name?: string;

  @IsString()
  @IsOptional()
  color_name?: string;

  @IsOptional()
  price?: number;

  @IsOptional()
  original_price?: number;

  @IsString()
  @IsOptional()
  image?: string;

  @IsOptional()
  max_stock?: number;
}

export class UpdateCartQuantityDto {
  @IsInt()
  @Min(0)
  quantity!: number;
}
