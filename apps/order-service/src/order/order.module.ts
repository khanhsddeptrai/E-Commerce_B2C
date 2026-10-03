import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrismaOrderService } from '../prisma/prisma-order.service';
import { ExpiredOrderWorker } from './expired-order.worker';
import { InventoryGrpcClientModule, inventoryClientProvider } from '../stock-sync/inventory-client';
import { StockSyncService } from '../stock-sync/stock-sync.service';
import { StockSyncWorker } from '../stock-sync/stock-sync.worker';

@Module({
  imports: [InventoryGrpcClientModule],
  controllers: [OrderController],
  providers: [
    OrderService,
    PrismaOrderService,
    ExpiredOrderWorker,
    inventoryClientProvider,
    StockSyncService,
    StockSyncWorker,
  ],
  exports: [OrderService, ExpiredOrderWorker, StockSyncService],
})
export class OrderModule {}
