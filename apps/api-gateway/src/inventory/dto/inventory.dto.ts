import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  NotEquals,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const INVENTORY_TRANSACTION_TYPES = ['INBOUND', 'OUTBOUND', 'RETURN', 'ADJUSTMENT'] as const;

class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class GetInventoryStocksQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  low_stock_only?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  low_stock_threshold?: number;
}

export class GetInventoryTransactionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  sku_id?: string;

  @IsOptional()
  @IsIn(INVENTORY_TRANSACTION_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  ref_id?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class GetReceiptsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class ReceiptItemInputDto {
  @IsString()
  @IsNotEmpty()
  sku_id!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  cost_price!: number;
}

export class CreateReceiptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  supplier_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemInputDto)
  items!: ReceiptItemInputDto[];
}

export class AdjustStockDto {
  @IsString()
  @IsNotEmpty()
  sku_id!: string;

  @IsInt()
  @NotEquals(0)
  quantity_delta!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
