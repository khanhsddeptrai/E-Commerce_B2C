import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import Redis from 'ioredis';
import { ProductPrisma } from '@repo/database';
import {
  AdjustStockRequest,
  AdjustStockResponse,
  CommitStockRequest,
  CreateReceiptRequest,
  GetSkusForOrderRequest,
  GetSkusForOrderResponse,
  HoldStockRequest,
  InventoryStockDto,
  ReceiptDto,
  ReceiveReturnRequest,
  ReleaseStockRequest,
  ReservationDto,
  ShipStockRequest,
  StockItem,
  StockOperationResponse,
} from '@repo/proto';
import { PrismaProductService } from '../prisma/prisma-product.service';
import { RESERVE_MULTI_LUA, RESTORE_MULTI_LUA, stockKey } from './stock-scripts';

const DEFAULT_HOLD_TTL_SECONDS = 15 * 60;
const MAX_CODE_ATTEMPTS = 5;

type Reservation = ProductPrisma.InventoryReservation;
type TransactionClient = ProductPrisma.Prisma.TransactionClient;
type ReceiptWithItems = ProductPrisma.Prisma.InventoryReceiptGetPayload<{
  include: { warehouse: true; items: { include: { sku: { include: { product: true } } } } };
}>;

interface NormalizedItem {
  skuId: string;
  quantity: number;
}

function rpcError(code: status, message: string): RpcException {
  return new RpcException({ code, message });
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof ProductPrisma.Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function isRecordNotFound(err: unknown): boolean {
  return err instanceof ProductPrisma.Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}

function rpcErrorCode(err: unknown): number | undefined {
  if (!(err instanceof RpcException)) return undefined;
  const payload = err.getError();
  return typeof payload === 'object' && payload !== null && 'code' in payload ? Number(payload.code) : undefined;
}

/** Mã chứng từ dạng PREFIX-YYMMDD-XXXX (vd GRN-261003-K7Q2) */
function generateDocumentCode(prefix: string): string {
  const now = new Date();
  const yymmdd = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(4, '0');
  return `${prefix}-${yymmdd}-${random}`;
}

/** Lỗi nội bộ báo hiệu một request khác đã xử lý cùng đơn hàng trong lúc này */
class ConcurrentOrderOperation extends Error {}

/** Lỗi nội bộ: điều chỉnh giảm làm tồn thực tế nhỏ hơn số đã chốt cho đơn */
class StockBelowReserved extends Error {}

/**
 * Quản lý tồn kho theo đơn hàng (WMS – docs/06-wms-implementation-plan.md).
 *
 * Nguồn sự thật: inventory_stocks (on_hand, reserved) + inventory_reservations trong PostgreSQL.
 * Redis stock:{skuId} = Σ(on_hand − reserved) − Σ HOLD chưa nhả, dùng để giữ hàng nhanh & nguyên tử.
 * Nguyên tắc khi có lỗi giữa chừng: luôn nghiêng về phía Redis THẤP hơn thực tế (bán thiếu),
 * không bao giờ cao hơn (bán vượt); ReconcileStock sẽ dựng lại Redis từ database.
 */
@Injectable()
export class InventoryService implements OnModuleDestroy {
  private readonly logger = new Logger(InventoryService.name);
  private readonly redis: Redis;
  private defaultWarehouseId: string | null = null;

  constructor(private readonly prisma: PrismaProductService) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  // ---------- RPC ----------

  async getSkusForOrder(data: GetSkusForOrderRequest): Promise<GetSkusForOrderResponse> {
    const ids = [...new Set(data.sku_ids || [])];
    if (ids.length === 0) return { skus: [] };

    const skus = await this.prisma.productSku.findMany({
      where: { id: { in: ids } },
      include: { product: true },
    });

    return {
      skus: skus.map((s) => ({
        id: s.id,
        sku_code: s.skuCode,
        sku_name: s.name,
        product_id: s.productId,
        product_name: s.product.name,
        product_status: s.product.status,
        price: Number(s.price),
        is_active: s.isActive,
        thumbnail_url: s.imageUrl || s.product.thumbnailUrl,
      })),
    };
  }

  /** Giữ hàng chờ thanh toán: trừ Redis nguyên tử cho mọi SKU, tạo reservation HOLD có hạn */
  async holdStock(data: HoldStockRequest): Promise<StockOperationResponse> {
    this.assertOrderRef(data.order_id, data.order_code);
    const items = this.normalizeItems(data.items);

    const existing = await this.findReservations(data.order_id);
    if (existing.length > 0) {
      return this.respond(existing, true, 'Đơn hàng đã được giữ hàng trước đó');
    }

    const warehouseId = await this.getDefaultWarehouseId();
    await this.reserveInRedis(items);

    const ttl = data.ttl_seconds && data.ttl_seconds > 0 ? data.ttl_seconds : DEFAULT_HOLD_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    try {
      const created = await this.prisma.$transaction(
        items.map((item) =>
          this.prisma.inventoryReservation.create({
            data: {
              orderId: data.order_id,
              orderCode: data.order_code,
              skuId: item.skuId,
              warehouseId,
              quantity: item.quantity,
              status: 'HOLD',
              expiresAt,
            },
          }),
        ),
      );
      return this.respond(created, false, 'Giữ hàng thành công');
    } catch (err: unknown) {
      await this.restoreInRedis(items);
      if (isUniqueViolation(err)) {
        // Một request khác vừa giữ hàng cho cùng đơn này
        return this.respond(await this.findReservations(data.order_id), true, 'Đơn hàng đã được giữ hàng trước đó');
      }
      throw err;
    }
  }

  /**
   * Chốt đơn:
   * - Có giữ hàng HOLD → chuyển COMMITTED, reserved += số lượng (Redis đã trừ lúc giữ hàng).
   * - Chưa có giữ hàng (COD) hoặc giữ hàng đã bị nhả do hết hạn → giữ lại từ tồn còn bán được theo items;
   *   không đủ hàng → RESOURCE_EXHAUSTED.
   */
  async commitStock(data: CommitStockRequest): Promise<StockOperationResponse> {
    this.assertOrderRef(data.order_id, data.order_code);
    const existing = await this.findReservations(data.order_id);
    const holds = existing.filter((r) => r.status === 'HOLD');

    if (holds.length > 0) {
      const committedCount = await this.prisma.$transaction(async (tx) => {
        let count = 0;
        for (const hold of holds) {
          const res = await tx.inventoryReservation.updateMany({
            where: { id: hold.id, status: 'HOLD' },
            data: { status: 'COMMITTED', expiresAt: null },
          });
          if (res.count === 0) continue;
          await tx.inventoryStock.update({
            where: { skuId_warehouseId: { skuId: hold.skuId, warehouseId: hold.warehouseId } },
            data: { reserved: { increment: hold.quantity }, version: { increment: 1 } },
          });
          count += 1;
        }
        return count;
      });
      return this.respond(
        await this.findReservations(data.order_id),
        committedCount === 0,
        committedCount > 0 ? 'Chốt đơn thành công' : 'Đơn hàng đã được chốt trước đó',
      );
    }

    const hasActive = existing.some((r) => r.status === 'COMMITTED' || r.status === 'SHIPPED');
    if (hasActive) {
      return this.respond(existing, true, 'Đơn hàng đã được chốt trước đó');
    }

    // Không có giữ hàng còn hiệu lực: giữ lại trực tiếp từ tồn còn bán được
    const items = this.normalizeItems(data.items);
    const warehouseId = await this.getDefaultWarehouseId();
    await this.reserveInRedis(items);

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const item of items) {
          const previous = existing.find((r) => r.skuId === item.skuId && r.warehouseId === warehouseId);
          if (previous) {
            const res = await tx.inventoryReservation.updateMany({
              where: { id: previous.id, status: 'RELEASED' },
              data: { status: 'COMMITTED', quantity: item.quantity, expiresAt: null },
            });
            if (res.count === 0) throw new ConcurrentOrderOperation();
          } else {
            await tx.inventoryReservation.create({
              data: {
                orderId: data.order_id,
                orderCode: data.order_code,
                skuId: item.skuId,
                warehouseId,
                quantity: item.quantity,
                status: 'COMMITTED',
              },
            });
          }
          await tx.inventoryStock.update({
            where: { skuId_warehouseId: { skuId: item.skuId, warehouseId } },
            data: { reserved: { increment: item.quantity }, version: { increment: 1 } },
          });
        }
      });
    } catch (err: unknown) {
      await this.restoreInRedis(items);
      if (err instanceof ConcurrentOrderOperation || isUniqueViolation(err)) {
        return this.respond(await this.findReservations(data.order_id), true, 'Đơn hàng đã được chốt trước đó');
      }
      throw err;
    }

    return this.respond(await this.findReservations(data.order_id), false, 'Chốt đơn thành công');
  }

  /** Nhả hàng: HOLD / COMMITTED → RELEASED, giảm reserved (nếu đã chốt) và cộng trả Redis */
  async releaseStock(data: ReleaseStockRequest): Promise<StockOperationResponse> {
    if (!data.order_id) throw rpcError(status.INVALID_ARGUMENT, 'Thiếu mã đơn hàng');
    const existing = await this.findReservations(data.order_id);

    if (existing.length === 0) {
      return this.respond(existing, true, 'Đơn hàng không có giữ hàng nào');
    }
    if (existing.some((r) => r.status === 'SHIPPED')) {
      throw rpcError(
        status.FAILED_PRECONDITION,
        'Đơn hàng đã xuất kho, không thể nhả hàng – hãy dùng chức năng nhận hàng hoàn',
      );
    }

    const released = await this.prisma.$transaction(async (tx) => {
      const done: Reservation[] = [];
      for (const r of existing) {
        if (r.status !== 'HOLD' && r.status !== 'COMMITTED') continue;
        const res = await tx.inventoryReservation.updateMany({
          where: { id: r.id, status: r.status },
          data: { status: 'RELEASED', expiresAt: null },
        });
        if (res.count === 0) continue;
        if (r.status === 'COMMITTED') {
          await tx.inventoryStock.update({
            where: { skuId_warehouseId: { skuId: r.skuId, warehouseId: r.warehouseId } },
            data: { reserved: { decrement: r.quantity }, version: { increment: 1 } },
          });
        }
        done.push(r);
      }
      return done;
    });

    if (released.length > 0) {
      await this.restoreInRedis(this.mergeItems(released));
      this.logger.log(`Nhả hàng đơn ${data.order_id} (${data.reason || 'không rõ lý do'}): ${released.length} dòng`);
    }

    return this.respond(
      await this.findReservations(data.order_id),
      released.length === 0,
      released.length > 0 ? 'Nhả hàng thành công' : 'Đơn hàng đã được nhả hàng trước đó',
    );
  }

  /** Xuất kho: COMMITTED → SHIPPED, on_hand và reserved cùng giảm, ghi sổ OUTBOUND (Redis không đổi) */
  async shipStock(data: ShipStockRequest): Promise<StockOperationResponse> {
    if (!data.order_id) throw rpcError(status.INVALID_ARGUMENT, 'Thiếu mã đơn hàng');
    const existing = await this.findReservations(data.order_id);

    if (existing.length === 0) {
      throw rpcError(status.NOT_FOUND, 'Đơn hàng chưa có giữ hàng nào trong kho');
    }
    if (existing.some((r) => r.status === 'HOLD')) {
      throw rpcError(status.FAILED_PRECONDITION, 'Đơn hàng chưa được chốt, không thể xuất kho');
    }
    const committed = existing.filter((r) => r.status === 'COMMITTED');
    if (committed.length === 0) {
      if (existing.some((r) => r.status === 'SHIPPED')) {
        return this.respond(existing, true, 'Đơn hàng đã được xuất kho trước đó');
      }
      throw rpcError(status.FAILED_PRECONDITION, 'Đơn hàng đã được nhả hàng, không thể xuất kho');
    }

    const shippedCount = await this.prisma.$transaction(async (tx) => {
      let count = 0;
      for (const r of committed) {
        const res = await tx.inventoryReservation.updateMany({
          where: { id: r.id, status: 'COMMITTED' },
          data: { status: 'SHIPPED' },
        });
        if (res.count === 0) continue;
        const stock = await tx.inventoryStock.update({
          where: { skuId_warehouseId: { skuId: r.skuId, warehouseId: r.warehouseId } },
          data: {
            onHand: { decrement: r.quantity },
            reserved: { decrement: r.quantity },
            version: { increment: 1 },
          },
        });
        await tx.inventoryTransaction.create({
          data: {
            skuId: r.skuId,
            warehouseId: r.warehouseId,
            type: 'OUTBOUND',
            quantity: -r.quantity,
            balanceAfter: stock.onHand,
            refType: 'ORDER',
            refId: r.orderCode,
            note: `Xuất kho giao đơn ${r.orderCode}`,
            createdBy: data.performed_by || 'SYSTEM',
          },
        });
        count += 1;
      }
      return count;
    });

    return this.respond(
      await this.findReservations(data.order_id),
      shippedCount === 0,
      shippedCount > 0 ? 'Xuất kho thành công' : 'Đơn hàng đã được xuất kho trước đó',
    );
  }

  /**
   * Nhận lại hàng hoàn của đơn đã xuất kho: on_hand tăng, ghi sổ RETURN, cộng trả Redis.
   * items rỗng = nhận lại toàn bộ số đã xuất; chỉ định items khi một phần hàng hỏng không nhập lại kho.
   */
  async receiveReturn(data: ReceiveReturnRequest): Promise<StockOperationResponse> {
    if (!data.order_id) throw rpcError(status.INVALID_ARGUMENT, 'Thiếu mã đơn hàng');
    const existing = await this.findReservations(data.order_id);
    if (existing.length === 0) {
      throw rpcError(status.NOT_FOUND, 'Đơn hàng chưa có giữ hàng nào trong kho');
    }
    const shipped = existing.filter((r) => r.status === 'SHIPPED');
    if (shipped.length === 0) {
      throw rpcError(status.FAILED_PRECONDITION, 'Đơn hàng chưa xuất kho, không có hàng hoàn để nhận');
    }

    const orderCode = shipped[0]!.orderCode;
    const alreadyReturned = await this.prisma.inventoryTransaction.count({
      where: { refType: 'ORDER', refId: orderCode, type: 'RETURN' },
    });
    if (alreadyReturned > 0) {
      return this.respond(existing, true, 'Đơn hàng đã được nhận hàng hoàn trước đó');
    }

    const requested = data.items && data.items.length > 0 ? this.normalizeItems(data.items) : null;
    if (requested) {
      for (const item of requested) {
        const r = shipped.find((s) => s.skuId === item.skuId);
        if (!r) throw rpcError(status.INVALID_ARGUMENT, 'Sản phẩm nhận lại không thuộc đơn hàng đã xuất kho');
        if (item.quantity > r.quantity) {
          throw rpcError(status.INVALID_ARGUMENT, `Số lượng nhận lại vượt số đã xuất (${r.quantity})`);
        }
      }
    }
    const toReturn = shipped
      .map((r) => ({
        reservation: r,
        quantity: requested ? (requested.find((i) => i.skuId === r.skuId)?.quantity ?? 0) : r.quantity,
      }))
      .filter((x) => x.quantity > 0);

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const { reservation: r, quantity } of toReturn) {
          const stock = await tx.inventoryStock.update({
            where: { skuId_warehouseId: { skuId: r.skuId, warehouseId: r.warehouseId } },
            data: { onHand: { increment: quantity }, version: { increment: 1 } },
          });
          await tx.inventoryTransaction.create({
            data: {
              skuId: r.skuId,
              warehouseId: r.warehouseId,
              type: 'RETURN',
              quantity,
              balanceAfter: stock.onHand,
              refType: 'ORDER',
              refId: orderCode,
              note: data.note || `Nhận lại hàng hoàn đơn ${orderCode}`,
              createdBy: data.performed_by || 'SYSTEM',
            },
          });
        }
      });
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        return this.respond(existing, true, 'Đơn hàng đã được nhận hàng hoàn trước đó');
      }
      throw err;
    }

    await this.restoreInRedis(this.mergeItems(toReturn.map((x) => ({ skuId: x.reservation.skuId, quantity: x.quantity }))));
    return this.respond(existing, false, 'Nhận hàng hoàn thành công');
  }

  /** Phiếu nhập kho: on_hand tăng theo từng dòng, ghi sổ INBOUND, cộng Redis */
  async createReceipt(data: CreateReceiptRequest): Promise<ReceiptDto> {
    if (!data.items || data.items.length === 0) {
      throw rpcError(status.INVALID_ARGUMENT, 'Phiếu nhập phải có ít nhất 1 sản phẩm');
    }
    const seen = new Set<string>();
    for (const item of data.items) {
      if (!item.sku_id || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw rpcError(status.INVALID_ARGUMENT, 'Mỗi dòng phiếu nhập cần sku_id và số lượng nguyên dương');
      }
      if (!Number.isFinite(item.cost_price) || item.cost_price < 0) {
        throw rpcError(status.INVALID_ARGUMENT, 'Giá vốn nhập không hợp lệ');
      }
      if (seen.has(item.sku_id)) {
        throw rpcError(status.INVALID_ARGUMENT, 'Một sản phẩm chỉ được xuất hiện một lần trong phiếu nhập');
      }
      seen.add(item.sku_id);
    }

    const warehouseId = await this.resolveWarehouseId(data.warehouse_id);
    const skuCount = await this.prisma.productSku.count({ where: { id: { in: [...seen] } } });
    if (skuCount !== seen.size) {
      throw rpcError(status.NOT_FOUND, 'Một số sản phẩm trong phiếu nhập không tồn tại');
    }

    const createdBy = data.created_by || 'SYSTEM';
    const receipt = await this.withUniqueCode('GRN', (code) =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.inventoryReceipt.create({
          data: {
            code,
            warehouseId,
            supplierName: data.supplier_name || null,
            note: data.note || null,
            createdBy,
            items: {
              create: data.items.map((i) => ({ skuId: i.sku_id, quantity: i.quantity, costPrice: i.cost_price })),
            },
          },
        });
        for (const item of data.items) {
          await this.increaseOnHand(tx, {
            skuId: item.sku_id,
            warehouseId,
            quantity: item.quantity,
            type: 'INBOUND',
            refType: 'RECEIPT',
            refId: code,
            note: data.supplier_name ? `Nhập kho từ ${data.supplier_name}` : 'Nhập kho theo phiếu',
            createdBy,
          });
        }
        return created;
      }),
    );

    await this.restoreInRedis(data.items.map((i) => ({ skuId: i.sku_id, quantity: i.quantity })));

    const full = await this.prisma.inventoryReceipt.findUniqueOrThrow({
      where: { id: receipt.id },
      include: { warehouse: true, items: { include: { sku: { include: { product: true } } } } },
    });
    return this.mapReceipt(full);
  }

  /**
   * Điều chỉnh kiểm kê on_hand ± quantity_delta, ghi sổ ADJUSTMENT.
   * Giảm: chỉ được giảm phần còn bán được (không đụng phần đã giữ / đã chốt cho đơn) — kiểm tra nguyên tử trên Redis.
   */
  async adjustStock(data: AdjustStockRequest): Promise<AdjustStockResponse> {
    if (!data.sku_id || !Number.isInteger(data.quantity_delta) || data.quantity_delta === 0) {
      throw rpcError(status.INVALID_ARGUMENT, 'Cần sku_id và số lượng điều chỉnh là số nguyên khác 0');
    }
    if (!data.reason || !data.reason.trim()) {
      throw rpcError(status.INVALID_ARGUMENT, 'Cần nhập lý do điều chỉnh tồn kho');
    }

    const warehouseId = await this.resolveWarehouseId(data.warehouse_id);
    const createdBy = data.created_by || 'SYSTEM';
    const delta = data.quantity_delta;
    const item = { skuId: data.sku_id, quantity: Math.abs(delta) };

    if (delta > 0) {
      const { code, stock } = await this.withUniqueCode('ADJ', async (code) => ({
        code,
        stock: await this.prisma.$transaction((tx) =>
          this.increaseOnHand(tx, {
            skuId: data.sku_id,
            warehouseId,
            quantity: delta,
            type: 'ADJUSTMENT',
            refType: 'ADJUSTMENT',
            refId: code,
            note: data.reason,
            createdBy,
          }),
        ),
      }));
      await this.restoreInRedis([item]);
      return { stock: this.mapStock(stock), adjustment_code: code };
    }

    // Giảm: giữ trước phần cần giảm trên Redis (nguyên tử) để không lấn vào hàng đang giữ / đã chốt
    const existingStock = await this.prisma.inventoryStock.findUnique({
      where: { skuId_warehouseId: { skuId: data.sku_id, warehouseId } },
    });
    if (!existingStock) throw rpcError(status.NOT_FOUND, 'Sản phẩm chưa có tồn tại kho này');
    try {
      await this.reserveInRedis([item]);
    } catch (err: unknown) {
      if (rpcErrorCode(err) === status.RESOURCE_EXHAUSTED) {
        throw rpcError(
          status.FAILED_PRECONDITION,
          'Không thể giảm tồn nhiều hơn số lượng còn bán được (phần còn lại đã được giữ / chốt cho đơn hàng)',
        );
      }
      throw err;
    }

    try {
      const { code, stock } = await this.withUniqueCode('ADJ', async (code) => ({
        code,
        stock: await this.prisma.$transaction(async (tx) => {
          const updated = await tx.inventoryStock.update({
            where: { skuId_warehouseId: { skuId: data.sku_id, warehouseId } },
            data: { onHand: { decrement: item.quantity }, version: { increment: 1 } },
          });
          if (updated.onHand < updated.reserved) throw new StockBelowReserved();
          await tx.inventoryTransaction.create({
            data: {
              skuId: data.sku_id,
              warehouseId,
              type: 'ADJUSTMENT',
              quantity: delta,
              balanceAfter: updated.onHand,
              refType: 'ADJUSTMENT',
              refId: code,
              note: data.reason,
              createdBy,
            },
          });
          return updated;
        }),
      }));
      return { stock: this.mapStock(stock), adjustment_code: code };
    } catch (err: unknown) {
      // Hoàn lại phần đã trừ trên Redis vì database không thay đổi
      await this.restoreInRedis([item]);
      if (err instanceof StockBelowReserved) {
        throw rpcError(status.FAILED_PRECONDITION, 'Tồn thực tế không thể nhỏ hơn số lượng đã chốt cho đơn hàng');
      }
      throw err;
    }
  }

  // ---------- Dùng cho Catalog (giai đoạn chuyển đổi sang WMS) ----------

  /** id kho mặc định, hoặc null nếu WMS chưa được bật (chưa chạy backfill) */
  async findDefaultWarehouseId(): Promise<string | null> {
    if (this.defaultWarehouseId) return this.defaultWarehouseId;
    const warehouse = await this.prisma.warehouse.findFirst({ where: { isDefault: true, isActive: true } });
    // Chỉ cache khi đã có kho: backfill có thể chạy trong lúc service đang hoạt động
    if (warehouse) this.defaultWarehouseId = warehouse.id;
    return warehouse?.id ?? null;
  }

  /** Khởi tạo tồn cho SKU mới tạo (trong transaction tạo sản phẩm): ghi sổ INBOUND tồn đầu kỳ */
  async initializeSkuStocks(
    tx: TransactionClient,
    warehouseId: string,
    skus: { id: string; quantity: number }[],
    refId: string,
    createdBy: string,
  ): Promise<void> {
    for (const sku of skus) {
      await this.increaseOnHand(tx, {
        skuId: sku.id,
        warehouseId,
        quantity: sku.quantity,
        type: 'INBOUND',
        refType: 'OPENING',
        refId,
        note: 'Tồn ban đầu khi tạo sản phẩm',
        createdBy,
      });
    }
  }

  /**
   * Đặt tồn thực tế của SKU tại kho mặc định về giá trị mới bằng phiếu điều chỉnh phần chênh lệch.
   * Trả null nếu WMS chưa được bật hoặc SKU chưa có dòng tồn (dùng hành vi cũ).
   */
  async setOnHand(skuId: string, target: number, createdBy: string, reason: string): Promise<InventoryStockDto | null> {
    const warehouseId = await this.findDefaultWarehouseId();
    if (!warehouseId) return null;
    if (!Number.isInteger(target) || target < 0) {
      throw rpcError(status.INVALID_ARGUMENT, 'Tồn kho phải là số nguyên không âm');
    }
    const current = await this.prisma.inventoryStock.findUnique({
      where: { skuId_warehouseId: { skuId, warehouseId } },
    });
    if (!current) return null;

    const delta = target - current.onHand;
    if (delta === 0) return this.mapStock(current);
    const res = await this.adjustStock({ sku_id: skuId, warehouse_id: warehouseId, quantity_delta: delta, reason, created_by: createdBy });
    return res.stock;
  }

  // ---------- Redis ----------

  /** Trừ Redis nguyên tử cho mọi SKU; thiếu hàng → RESOURCE_EXHAUSTED kèm tên SKU */
  private async reserveInRedis(items: NormalizedItem[]): Promise<void> {
    await this.ensureStockKeys(items.map((i) => i.skuId));
    const keys = items.map((i) => stockKey(i.skuId));
    const quantities = items.map((i) => i.quantity);
    const failedIndex = (await this.redis.eval(RESERVE_MULTI_LUA, keys.length, ...keys, ...quantities)) as number;

    if (failedIndex !== 0) {
      const failed = items[failedIndex - 1];
      const sku = failed
        ? await this.prisma.productSku.findUnique({ where: { id: failed.skuId }, include: { product: true } })
        : null;
      const label = sku ? `"${sku.product.name} (${sku.name})"` : 'trong đơn';
      throw rpcError(status.RESOURCE_EXHAUSTED, `Sản phẩm ${label} không đủ số lượng tồn kho`);
    }
  }

  /** Cộng trả Redis sau khi database đã cập nhật; lỗi Redis chỉ ghi log (Redis thấp hơn thực tế = an toàn) */
  private async restoreInRedis(items: NormalizedItem[]): Promise<void> {
    if (items.length === 0) return;
    try {
      const keys = items.map((i) => stockKey(i.skuId));
      await this.redis.eval(RESTORE_MULTI_LUA, keys.length, ...keys, ...items.map((i) => i.quantity));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Không cộng trả được tồn Redis (cần ReconcileStock): ${message}`);
    }
  }

  /** Khởi tạo key Redis còn thiếu từ database (SET NX để không ghi đè giá trị đang dùng) */
  private async ensureStockKeys(skuIds: string[]): Promise<void> {
    const values = await this.redis.mget(...skuIds.map(stockKey));
    const missing = skuIds.filter((_, idx) => values[idx] === null);
    if (missing.length === 0) return;

    const available = await this.computeAvailableFromDb(missing);
    const pipeline = this.redis.pipeline();
    for (const skuId of missing) {
      pipeline.set(stockKey(skuId), Math.max(0, available.get(skuId) ?? 0), 'NX');
    }
    await pipeline.exec();
  }

  /** Còn bán được = Σ(on_hand − reserved) − Σ HOLD chưa nhả (kể cả đã quá hạn nhưng worker chưa xử lý) */
  private async computeAvailableFromDb(skuIds: string[]): Promise<Map<string, number>> {
    const [stocks, holds] = await Promise.all([
      this.prisma.inventoryStock.groupBy({
        by: ['skuId'],
        where: { skuId: { in: skuIds } },
        _sum: { onHand: true, reserved: true },
      }),
      this.prisma.inventoryReservation.groupBy({
        by: ['skuId'],
        where: { skuId: { in: skuIds }, status: 'HOLD' },
        _sum: { quantity: true },
      }),
    ]);

    const available = new Map<string, number>();
    for (const s of stocks) {
      available.set(s.skuId, (s._sum.onHand ?? 0) - (s._sum.reserved ?? 0));
    }
    for (const h of holds) {
      available.set(h.skuId, (available.get(h.skuId) ?? 0) - (h._sum.quantity ?? 0));
    }
    return available;
  }

  // ---------- Tiện ích ----------

  private async getDefaultWarehouseId(): Promise<string> {
    const warehouseId = await this.findDefaultWarehouseId();
    if (!warehouseId) {
      throw rpcError(
        status.FAILED_PRECONDITION,
        'Chưa khởi tạo kho mặc định – chạy pnpm --filter @repo/database db:inventory:backfill',
      );
    }
    return warehouseId;
  }

  private async resolveWarehouseId(warehouseId: string | undefined): Promise<string> {
    if (!warehouseId) return this.getDefaultWarehouseId();
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, isActive: true } });
    if (!warehouse) throw rpcError(status.NOT_FOUND, 'Không tìm thấy kho hoặc kho đã ngừng hoạt động');
    return warehouse.id;
  }

  /** Tăng on_hand (tạo dòng tồn nếu chưa có) và ghi sổ trong cùng transaction */
  private async increaseOnHand(
    tx: TransactionClient,
    input: {
      skuId: string;
      warehouseId: string;
      quantity: number;
      type: ProductPrisma.InventoryTransactionType;
      refType: string;
      refId: string;
      note: string;
      createdBy: string;
    },
  ): Promise<ProductPrisma.InventoryStock> {
    const stock = await tx.inventoryStock.upsert({
      where: { skuId_warehouseId: { skuId: input.skuId, warehouseId: input.warehouseId } },
      create: { skuId: input.skuId, warehouseId: input.warehouseId, onHand: input.quantity },
      update: { onHand: { increment: input.quantity }, version: { increment: 1 } },
    });
    if (input.quantity > 0) {
      await tx.inventoryTransaction.create({
        data: {
          skuId: input.skuId,
          warehouseId: input.warehouseId,
          type: input.type,
          quantity: input.quantity,
          balanceAfter: stock.onHand,
          refType: input.refType,
          refId: input.refId,
          note: input.note,
          createdBy: input.createdBy,
        },
      });
    }
    return stock;
  }

  /** Chạy thao tác cần mã chứng từ duy nhất; sinh lại mã nếu trùng */
  private async withUniqueCode<T>(prefix: string, run: (code: string) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await run(generateDocumentCode(prefix));
      } catch (err: unknown) {
        if (!isUniqueViolation(err) || attempt >= MAX_CODE_ATTEMPTS) {
          if (isRecordNotFound(err)) throw rpcError(status.NOT_FOUND, 'Sản phẩm chưa có tồn tại kho này');
          throw err;
        }
      }
    }
  }

  private mapStock(stock: ProductPrisma.InventoryStock): InventoryStockDto {
    return {
      sku_id: stock.skuId,
      warehouse_id: stock.warehouseId,
      on_hand: stock.onHand,
      reserved: stock.reserved,
    };
  }

  private mapReceipt(receipt: ReceiptWithItems): ReceiptDto {
    const items = receipt.items.map((i) => ({
      sku_id: i.skuId,
      sku_code: i.sku.skuCode,
      sku_name: i.sku.name,
      product_name: i.sku.product.name,
      quantity: i.quantity,
      cost_price: Number(i.costPrice),
    }));
    return {
      id: receipt.id,
      code: receipt.code,
      warehouse_id: receipt.warehouseId,
      warehouse_code: receipt.warehouse.code,
      supplier_name: receipt.supplierName ?? '',
      note: receipt.note ?? '',
      created_by: receipt.createdBy,
      created_at: receipt.createdAt.toISOString(),
      items,
      total_quantity: items.reduce((sum, i) => sum + i.quantity, 0),
      total_cost: items.reduce((sum, i) => sum + i.quantity * i.cost_price, 0),
    };
  }

  private findReservations(orderId: string): Promise<Reservation[]> {
    return this.prisma.inventoryReservation.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
  }

  private assertOrderRef(orderId: string, orderCode: string): void {
    if (!orderId || !orderCode) {
      throw rpcError(status.INVALID_ARGUMENT, 'Thiếu mã đơn hàng (order_id, order_code)');
    }
  }

  /** Gộp SKU trùng và kiểm tra số lượng là số nguyên dương */
  private normalizeItems(items: StockItem[] | undefined): NormalizedItem[] {
    if (!items || items.length === 0) {
      throw rpcError(status.INVALID_ARGUMENT, 'Danh sách sản phẩm cần giữ hàng không được rỗng');
    }
    for (const item of items) {
      if (!item.sku_id || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw rpcError(status.INVALID_ARGUMENT, 'Mỗi sản phẩm cần sku_id và số lượng nguyên dương');
      }
    }
    return this.mergeItems(items.map((i) => ({ skuId: i.sku_id, quantity: i.quantity })));
  }

  private mergeItems(items: { skuId: string; quantity: number }[]): NormalizedItem[] {
    const merged = new Map<string, number>();
    for (const item of items) merged.set(item.skuId, (merged.get(item.skuId) ?? 0) + item.quantity);
    return [...merged.entries()].map(([skuId, quantity]) => ({ skuId, quantity }));
  }

  private respond(reservations: Reservation[], alreadyProcessed: boolean, message: string): StockOperationResponse {
    return {
      success: true,
      message,
      already_processed: alreadyProcessed,
      reservations: reservations.map(
        (r): ReservationDto => ({
          sku_id: r.skuId,
          quantity: r.quantity,
          status: r.status,
          expires_at: r.expiresAt ? r.expiresAt.toISOString() : undefined,
        }),
      ),
    };
  }
}
