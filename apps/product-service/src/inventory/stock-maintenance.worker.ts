import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InventoryService } from './inventory.service';

const RELEASE_INTERVAL_MS = 30_000;

/**
 * Bảo trì tồn kho định kỳ (chỉ chạy khi đã bật WMS – có kho mặc định):
 * - Lúc khởi động: ReconcileStock dựng lại Redis từ database. Hook này chạy trước khi gRPC server
 *   nhận request nên không có lượt giữ hàng nào đang dở dang.
 * - Mỗi 30 giây: nhả các lượt giữ hàng quá hạn (thay cho phần kho của ExpiredOrderWorker bên Order Service).
 */
@Injectable()
export class StockMaintenanceWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(StockMaintenanceWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private readonly inventory: InventoryService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (await this.inventory.findDefaultWarehouseId()) {
      try {
        const res = await this.inventory.reconcileStock({ sku_ids: [] });
        this.logger.log(`Đối soát tồn Redis lúc khởi động: ${res.checked} SKU, sửa ${res.drifts.length} SKU lệch`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Đối soát tồn Redis lúc khởi động thất bại: ${message}`);
      }
    } else {
      this.logger.log('Chưa bật WMS (chưa có kho mặc định) – bỏ qua bảo trì tồn kho');
    }

    this.timer = setInterval(() => {
      void this.releaseExpiredHolds();
    }, RELEASE_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async releaseExpiredHolds(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;
    try {
      if (!(await this.inventory.findDefaultWarehouseId())) return 0;
      return await this.inventory.releaseExpiredHolds();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Lỗi khi nhả giữ hàng quá hạn: ${message}`);
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }
}
