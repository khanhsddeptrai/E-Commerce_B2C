import { Inject, Injectable, Logger } from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { OrderPrisma } from '@repo/database';
import { InventoryServiceClient, StockItem, StockOperationResponse, StockSyncStatusValue } from '@repo/proto';
import { PrismaOrderService } from '../prisma/prisma-order.service';
import { INVENTORY_CLIENT } from './inventory-client';

export const MAX_ATTEMPTS = 20;
const BASE_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 10 * 60_000;
/** Thời gian "nhận" một task: trong khoảng này worker / request khác không xử lý trùng */
const LEASE_MS = 60_000;
const RPC_TIMEOUT_MS = 10_000;

/** Lỗi nghiệp vụ: thử lại cũng không thay đổi kết quả → FAILED ngay để admin xử lý */
const PERMANENT_ERROR_CODES = new Set<number>([
  status.INVALID_ARGUMENT,
  status.NOT_FOUND,
  status.ALREADY_EXISTS,
  status.PERMISSION_DENIED,
  status.FAILED_PRECONDITION,
  status.OUT_OF_RANGE,
  status.RESOURCE_EXHAUSTED,
]);

type Tx = OrderPrisma.Prisma.TransactionClient;
type Task = OrderPrisma.StockSyncTask;
type Action = OrderPrisma.StockSyncAction;

/** Dữ liệu kèm task: lý do nhả hàng, hoặc danh sách nhận hàng hoàn một phần */
export interface StockSyncPayload {
  reason?: string;
  items?: StockItem[];
  note?: string;
}

export interface StockSyncState {
  status: StockSyncStatusValue;
  error?: string;
}

function grpcCodeOf(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'number') return err.code;
  return undefined;
}

function errorMessageOf(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'details' in err && typeof err.details === 'string' && err.details) {
    return err.details;
  }
  return err instanceof Error ? err.message : String(err);
}

export function retryDelayMs(attempts: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_RETRY_DELAY_MS);
}

/**
 * Đồng bộ thao tác kho với Product Service theo mô hình "ghi ý định trước, gọi sau, thử lại tới khi xong"
 * (docs/06-wms-implementation-plan.md mục 5.1b – dạng đơn giản của Transactional Outbox).
 */
@Injectable()
export class StockSyncService {
  private readonly logger = new Logger(StockSyncService.name);

  constructor(
    private readonly prisma: PrismaOrderService,
    @Inject(INVENTORY_CLIENT) private readonly inventory: InventoryServiceClient,
  ) {}

  /** Ghi ý định thao tác kho — PHẢI gọi trong cùng transaction với thay đổi trạng thái đơn */
  enqueue(tx: Tx, orderId: string, action: Action, performedBy: string, payload?: StockSyncPayload): Promise<Task> {
    return tx.stockSyncTask.create({
      data: {
        orderId,
        action,
        performedBy,
        payload: payload ? (payload as OrderPrisma.Prisma.InputJsonObject) : undefined,
      },
    });
  }

  /** Xử lý tuần tự các task chưa xong của một đơn; dừng ở task đầu tiên chưa thành công */
  async processOrder(orderId: string, now: Date = new Date()): Promise<void> {
    for (;;) {
      const next = await this.prisma.stockSyncTask.findFirst({
        where: { orderId, status: { not: 'DONE' } },
        orderBy: { seq: 'asc' },
      });
      if (!next || next.status === 'FAILED' || next.nextRetryAt > now) return;

      const claimed = await this.claim(next, now);
      if (!claimed) return;
      const succeeded = await this.execute(claimed, now);
      if (!succeeded) return;
    }
  }

  /** Worker: xử lý các đơn có task đến hạn */
  async processDue(now: Date = new Date(), limit = 50): Promise<number> {
    const due = await this.prisma.stockSyncTask.findMany({
      where: { status: 'PENDING', nextRetryAt: { lte: now } },
      select: { orderId: true },
      distinct: ['orderId'],
      orderBy: { orderId: 'asc' },
      take: limit,
    });
    for (const { orderId } of due) {
      await this.processOrder(orderId, now);
    }
    return due.length;
  }

  /** Admin thử lại: đưa các task FAILED của đơn về PENDING và xử lý ngay */
  async retryOrder(orderId: string): Promise<StockSyncState> {
    await this.prisma.stockSyncTask.updateMany({
      where: { orderId, status: 'FAILED' },
      data: { status: 'PENDING', attempts: 0, nextRetryAt: new Date() },
    });
    await this.processOrder(orderId);
    return (await this.getSyncStates([orderId])).get(orderId) ?? { status: 'OK' };
  }

  /** Trạng thái đồng bộ kho của các đơn: FAILED > PENDING > OK */
  async getSyncStates(orderIds: string[]): Promise<Map<string, StockSyncState>> {
    const states = new Map<string, StockSyncState>();
    if (orderIds.length === 0) return states;

    const open = await this.prisma.stockSyncTask.findMany({
      where: { orderId: { in: orderIds }, status: { not: 'DONE' } },
      orderBy: { seq: 'asc' },
      select: { orderId: true, status: true, lastError: true },
    });
    for (const task of open) {
      const current = states.get(task.orderId);
      if (current?.status === 'FAILED') continue;
      if (task.status === 'FAILED') {
        states.set(task.orderId, { status: 'FAILED', error: task.lastError ?? undefined });
      } else if (!current) {
        states.set(task.orderId, { status: 'PENDING', error: task.lastError ?? undefined });
      }
    }
    for (const id of orderIds) {
      if (!states.has(id)) states.set(id, { status: 'OK' });
    }
    return states;
  }

  // ---------- Nội bộ ----------

  /** "Nhận" task bằng cập nhật có điều kiện: chỉ một tiến trình nhận được, kèm lease chống xử lý trùng */
  private async claim(task: Task, now: Date): Promise<Task | null> {
    const res = await this.prisma.stockSyncTask.updateMany({
      where: { id: task.id, status: 'PENDING', nextRetryAt: { lte: now } },
      data: { nextRetryAt: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
    });
    if (res.count === 0) return null;
    return { ...task, attempts: task.attempts + 1 };
  }

  private async execute(task: Task, now: Date): Promise<boolean> {
    try {
      await this.callInventory(task);
      await this.prisma.stockSyncTask.update({
        where: { id: task.id },
        data: { status: 'DONE', lastError: null },
      });
      return true;
    } catch (err: unknown) {
      const code = grpcCodeOf(err);
      const message = errorMessageOf(err);
      const permanent = code !== undefined && PERMANENT_ERROR_CODES.has(code);
      const exhausted = task.attempts >= MAX_ATTEMPTS;

      if (permanent || exhausted) {
        await this.prisma.stockSyncTask.update({
          where: { id: task.id },
          data: { status: 'FAILED', lastError: message },
        });
        this.logger.error(
          `Task kho ${task.action} của đơn ${task.orderId} THẤT BẠI (${permanent ? 'lỗi nghiệp vụ' : `quá ${MAX_ATTEMPTS} lần`}): ${message}`,
        );
      } else {
        await this.prisma.stockSyncTask.update({
          where: { id: task.id },
          data: { lastError: message, nextRetryAt: new Date(now.getTime() + retryDelayMs(task.attempts)) },
        });
        this.logger.warn(`Task kho ${task.action} của đơn ${task.orderId} lỗi lần ${task.attempts}, sẽ thử lại: ${message}`);
      }
      return false;
    }
  }

  private async callInventory(task: Task): Promise<StockOperationResponse> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: task.orderId },
      include: { items: true },
    });
    const payload = (task.payload ?? {}) as StockSyncPayload;

    switch (task.action) {
      case 'COMMIT':
        return this.call(
          this.inventory.commitStock({
            order_id: order.id,
            order_code: order.orderCode,
            items: this.mergeItems(order.items.map((i) => ({ sku_id: i.skuId, quantity: i.quantity }))),
          }),
        );
      case 'RELEASE':
        return this.call(this.inventory.releaseStock({ order_id: order.id, reason: payload.reason || 'Đơn hàng bị hủy' }));
      case 'SHIP':
        return this.call(this.inventory.shipStock({ order_id: order.id, performed_by: task.performedBy }));
      case 'RETURN':
        return this.call(
          this.inventory.receiveReturn({
            order_id: order.id,
            performed_by: task.performedBy,
            items: payload.items ?? [],
            note: payload.note ?? '',
          }),
        );
    }
  }

  private call<T>(source: Observable<T>): Promise<T> {
    return firstValueFrom(source.pipe(timeout(RPC_TIMEOUT_MS)));
  }

  private mergeItems(items: StockItem[]): StockItem[] {
    const merged = new Map<string, number>();
    for (const item of items) merged.set(item.sku_id, (merged.get(item.sku_id) ?? 0) + item.quantity);
    return [...merged.entries()].map(([sku_id, quantity]) => ({ sku_id, quantity }));
  }
}
