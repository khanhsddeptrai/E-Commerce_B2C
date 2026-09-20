import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { OrderPrisma } from '@repo/database';
import { PrismaOrderService } from '../prisma/prisma-order.service';

@Injectable()
export class ExpiredOrderWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpiredOrderWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly redis: Redis;

  constructor(private readonly prisma: PrismaOrderService) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });
  }

  onModuleInit(): void {
    this.logger.log('Khởi động ExpiredOrderWorker (chu kỳ quét: 30s)...');
    // Khởi chạy quét định kỳ mỗi 30 giây
    this.timer = setInterval(() => {
      void this.processExpiredReservations();
    }, 30000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.redis.disconnect();
  }

  /**
   * Quét và hủy các đơn hàng quá hạn thanh toán 15 phút (HOLD -> RELEASED)
   * và nhả lại số lượng tồn kho trên Redis
   */
  async processExpiredReservations(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const now = new Date();
      // Tìm các bản ghi giữ kho hết hạn (HOLD và expiresAt <= NOW)
      const expiredList = await this.prisma.inventoryReservation.findMany({
        where: {
          status: OrderPrisma.ReservationStatus.HOLD,
          expiresAt: {
            lte: now,
          },
        },
        include: {
          order: true,
        },
        take: 100, // Giới hạn batch xử lý
      });

      if (expiredList.length === 0) {
        return 0;
      }

      this.logger.warn(`Phát hiện ${expiredList.length} bản ghi giữ kho quá hạn cần giải phóng.`);

      const orderIdsToCancel = new Set<string>();

      for (const res of expiredList) {
        // 1. Cập nhật reservation sang RELEASED
        await this.prisma.inventoryReservation.update({
          where: { id: res.id },
          data: { status: OrderPrisma.ReservationStatus.RELEASED },
        });

        // 2. Hoàn lại số lượng tồn kho trên Redis
        const stockKey = `stock:${res.skuId}`;
        const exists = await this.redis.exists(stockKey);
        if (exists) {
          await this.redis.incrby(stockKey, res.quantity);
          this.logger.log(`Đã hoàn kho Redis: ${stockKey} +${res.quantity}`);
        }

        // 3. Gom các orderId cần hủy
        if (res.orderId && res.order?.orderStatus === OrderPrisma.OrderStatus.PENDING) {
          orderIdsToCancel.add(res.orderId);
        }
      }

      // 4. Hủy các đơn hàng liên quan nếu vẫn ở trạng thái PENDING
      for (const orderId of orderIdsToCancel) {
        await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: orderId },
            data: {
              orderStatus: OrderPrisma.OrderStatus.CANCELLED,
              cancelReason: 'Quá hạn thanh toán 15 phút',
            },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId,
              fromStatus: OrderPrisma.OrderStatus.PENDING,
              toStatus: OrderPrisma.OrderStatus.CANCELLED,
              note: 'Đơn hàng quá hạn thanh toán 15 phút, hệ thống tự động hủy và hoàn lại tồn kho',
              changedBy: 'SYSTEM_WORKER',
            },
          });
        });

        this.logger.log(`Đã tự động hủy đơn hàng ID: ${orderId}`);
      }

      return expiredList.length;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Lỗi trong ExpiredOrderWorker: ${message}`);
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }
}
