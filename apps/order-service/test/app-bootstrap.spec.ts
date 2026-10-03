import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { OrderController } from '../src/order/order.controller';
import { StockSyncService } from '../src/stock-sync/stock-sync.service';
import { StockSyncWorker } from '../src/stock-sync/stock-sync.worker';

// Bắt lỗi đăng ký dependency injection (thiếu provider / import module) mà typecheck và unit test không phát hiện
describe('AppModule – khởi tạo toàn bộ dependency', () => {
  let app: INestApplicationContext;

  afterEach(async () => {
    await app?.close();
  });

  it('khởi tạo được controller, gRPC client kho và worker đồng bộ kho', async () => {
    // abortOnError: false → lỗi DI được ném ra thành lỗi test thay vì process.exit
    app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });

    expect(app.get(OrderController)).toBeInstanceOf(OrderController);
    expect(app.get(StockSyncService)).toBeInstanceOf(StockSyncService);
    expect(app.get(StockSyncWorker)).toBeInstanceOf(StockSyncWorker);
  });
});
