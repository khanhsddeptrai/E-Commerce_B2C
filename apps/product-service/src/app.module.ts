import { Module } from '@nestjs/common';
import { PrismaProductModule } from './prisma/prisma-product.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [PrismaProductModule, CatalogModule, InventoryModule],
})
export class AppModule {}
