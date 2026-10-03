import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { CatalogService } from '../src/catalog/catalog.service';
import { InventoryController } from '../src/inventory/inventory.controller';
import { InventoryService } from '../src/inventory/inventory.service';
import { StockMaintenanceWorker } from '../src/inventory/stock-maintenance.worker';

// Bắt lỗi đăng ký dependency injection (thiếu provider / import module) mà typecheck và unit test không phát hiện
describe('AppModule – khởi tạo toàn bộ dependency', () => {
  let app: INestApplicationContext;

  afterEach(async () => {
    await app?.close();
  });

  it('khởi tạo được mọi module, controller, worker và chạy hook khởi động', async () => {
    // abortOnError: false → lỗi DI được ném ra thành lỗi test thay vì process.exit
    app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });

    expect(app.get(CatalogService)).toBeInstanceOf(CatalogService);
    expect(app.get(InventoryService)).toBeInstanceOf(InventoryService);
    expect(app.get(InventoryController)).toBeInstanceOf(InventoryController);
    expect(app.get(StockMaintenanceWorker)).toBeInstanceOf(StockMaintenanceWorker);
  });
});
