import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePaymentUrlDto {
  @IsUUID()
  @IsNotEmpty()
  order_id!: string;

  @IsString()
  @IsNotEmpty()
  order_code!: string;

  @IsNumber()
  @Min(1000)
  amount!: number;

  @IsString()
  @IsOptional()
  payment_method?: string;

  @IsString()
  @IsOptional()
  bank_code?: string;

  @IsString()
  @IsOptional()
  return_url?: string;
}
