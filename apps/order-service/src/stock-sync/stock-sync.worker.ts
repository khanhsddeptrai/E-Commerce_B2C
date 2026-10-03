import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { StockSyncService } from './stock-sync.service';

const INTERVAL_MS = 30_000;

/** Định kỳ gọi lại các thao tác kho chưa đồng bộ được với Product Service (docs/06 mục 5.1b) */
@Injectable()
export class StockSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockSyncWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private readonly stockSync: StockSyncService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;
    try {
      return await this.stockSync.processDue();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Lỗi khi đồng bộ thao tác kho: ${message}`);
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }
}
