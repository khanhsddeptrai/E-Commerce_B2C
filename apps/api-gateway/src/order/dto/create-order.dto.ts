import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemInputDto {
  @IsString()
  @IsNotEmpty()
  sku_id!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  customer_id?: string;

  @IsString()
  @IsNotEmpty()
  customer_name!: string;

  @IsString()
  @IsNotEmpty()
  customer_phone!: string;

  @IsEmail()
  @IsNotEmpty()
  customer_email!: string;

  @IsString()
  @IsNotEmpty()
  shipping_address_json!: string;

  @IsString()
  @IsNotEmpty()
  payment_method!: string;

  @IsString()
  @IsOptional()
  voucher_code?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];
}

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
