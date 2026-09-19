import { Module, Global } from '@nestjs/common';
import { PrismaProductService } from './prisma-product.service';

@Global()
@Module({
  providers: [PrismaProductService],
  exports: [PrismaProductService],
})
export class PrismaProductModule {}
