import { Module } from '@nestjs/common';
import { PrismaProductModule } from './prisma/prisma-product.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [PrismaProductModule, CatalogModule],
})
export class AppModule {}
