import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrderPrisma } from '@repo/database';
import { PrismaOrderService } from '../prisma/prisma-order.service';
import { StockSyncService } from '../stock-sync/stock-sync.service';
import { PAYMENT_WINDOW_SECONDS } from './order.service';

const INTERVAL_MS = 30_000;
const CANCEL_REASON = 'Quá hạn thanh toán 15 phút';

/**
 * Hủy các đơn thanh toán trực tuyến quá hạn (PENDING quá 15 phút) và nhả hàng qua task RELEASE.
 * Product Service cũng tự nhả lượt giữ hàng quá hạn; task RELEASE idempotent nên không bị nhả hai lần.
 */
@Injectable()
export class ExpiredOrderWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpiredOrderWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaOrderService,
    private readonly stockSync: StockSyncService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Khởi động ExpiredOrderWorker (chu kỳ quét: 30s)...');
    this.timer = setInterval(() => {
      void this.processExpiredOrders();
    }, INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processExpiredOrders(now: Date = new Date(), batchSize = 100): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const deadline = new Date(now.getTime() - PAYMENT_WINDOW_SECONDS * 1000);
      const expired = await this.prisma.order.findMany({
        where: {
          orderStatus: OrderPrisma.OrderStatus.PENDING,
          paymentStatus: { not: OrderPrisma.PaymentStatus.PAID },
          paymentMethod: { not: OrderPrisma.PaymentMethod.COD },
          createdAt: { lte: deadline },
        },
        select: { id: true, orderCode: true },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
      });

      let cancelled = 0;
      for (const order of expired) {
        const done = await this.prisma.$transaction(async (tx) => {
          // Chỉ hủy nếu vẫn đang chờ thanh toán (có thể vừa được thanh toán trong lúc quét)
          const res = await tx.order.updateMany({
            where: { id: order.id, orderStatus: OrderPrisma.OrderStatus.PENDING },
            data: { orderStatus: OrderPrisma.OrderStatus.CANCELLED, cancelReason: CANCEL_REASON },
          });
          if (res.count === 0) return false;
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: OrderPrisma.OrderStatus.PENDING,
              toStatus: OrderPrisma.OrderStatus.CANCELLED,
              note: 'Đơn hàng quá hạn thanh toán 15 phút, hệ thống tự động hủy và hoàn lại tồn kho',
              changedBy: 'SYSTEM_WORKER',
            },
          });
          await this.stockSync.enqueue(tx, order.id, 'RELEASE', 'SYSTEM_WORKER', { reason: CANCEL_REASON });
          return true;
        });

        if (done) {
          cancelled += 1;
          await this.stockSync.processOrder(order.id);
          this.logger.log(`Đã tự động hủy đơn hàng quá hạn: ${order.orderCode}`);
        }
      }
      return cancelled;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Lỗi trong ExpiredOrderWorker: ${message}`);
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }
}
