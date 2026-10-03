import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryQueryService } from './inventory-query.service';
import { StockMaintenanceWorker } from './stock-maintenance.worker';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, InventoryQueryService, StockMaintenanceWorker],
  exports: [InventoryService],
})
export class InventoryModule {}
