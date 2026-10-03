import { Observable, defer, of, throwError } from 'rxjs';
import { status } from '@grpc/grpc-js';
import { OrderPrisma } from '@repo/database';
import {
  InventoryServiceClient,
  OrderSkuDto,
  StockOperationResponse,
} from '@repo/proto';
import { PrismaOrderService } from '../src/prisma/prisma-order.service';
import { assertTestDatabaseName } from './test-env';

/** Xóa sạch dữ liệu mọi bảng (giữ lịch sử migrations) — chỉ chạy trên database _test */
export async function resetOrderDb(prisma: PrismaOrderService): Promise<void> {
  const [row] = await prisma.$queryRawUnsafe<{ current_database: string }[]>('SELECT current_database()');
  assertTestDatabaseName(row?.current_database ?? '');
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length === 0) return;
  const tableList = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

/** Lỗi giống lỗi gRPC phía client (có code + details) */
export function grpcError(code: number, details: string): Error & { code: number; details: string } {
  return Object.assign(new Error(`${code} ${details}`), { code, details });
}

export const UNAVAILABLE = () => grpcError(status.UNAVAILABLE, 'Product Service không phản hồi');

type Method = keyof InventoryServiceClient;
type Behavior = 'ok' | (() => Error);

const OK: StockOperationResponse = { success: true, message: 'ok', reservations: [], already_processed: false };

/**
 * InventoryServiceClient giả: ghi lại mọi lời gọi và cho phép mô phỏng lỗi theo từng method.
 * Mặc định mọi lời gọi thành công.
 */
export class FakeInventoryClient implements InventoryServiceClient {
  readonly calls: { method: Method; request: unknown }[] = [];
  private behaviors = new Map<Method, Behavior[]>();
  private defaults = new Map<Method, Behavior>();

  /** Các lần gọi kế tiếp của method lần lượt dùng các hành vi này, sau đó quay về mặc định */
  queue(method: Method, ...behaviors: Behavior[]): this {
    this.behaviors.set(method, [...(this.behaviors.get(method) ?? []), ...behaviors]);
    return this;
  }

  /** Hành vi mặc định của method (vd luôn lỗi UNAVAILABLE để mô phỏng service ngừng hoạt động) */
  always(method: Method, behavior: Behavior): this {
    this.defaults.set(method, behavior);
    return this;
  }

  callsOf(method: Method): unknown[] {
    return this.calls.filter((c) => c.method === method).map((c) => c.request);
  }

  private respond<T>(method: Method, request: unknown, value: T): Observable<T> {
    return defer(() => {
      this.calls.push({ method, request });
      const queued = this.behaviors.get(method);
      const behavior = queued && queued.length > 0 ? queued.shift()! : (this.defaults.get(method) ?? 'ok');
      return behavior === 'ok' ? of(value) : throwError(behavior);
    });
  }

  /** SKU mà getSkusForOrder trả về (lọc theo sku_ids được hỏi) */
  skus: OrderSkuDto[] = [];

  getSkusForOrder = (r: Parameters<InventoryServiceClient['getSkusForOrder']>[0]) =>
    this.respond('getSkusForOrder', r, { skus: this.skus.filter((s) => r.sku_ids.includes(s.id)) });
  holdStock = (r: Parameters<InventoryServiceClient['holdStock']>[0]) => this.respond('holdStock', r, OK);
  commitStock = (r: Parameters<InventoryServiceClient['commitStock']>[0]) => this.respond('commitStock', r, OK);
  releaseStock = (r: Parameters<InventoryServiceClient['releaseStock']>[0]) => this.respond('releaseStock', r, OK);
  shipStock = (r: Parameters<InventoryServiceClient['shipStock']>[0]) => this.respond('shipStock', r, OK);
  receiveReturn = (r: Parameters<InventoryServiceClient['receiveReturn']>[0]) => this.respond('receiveReturn', r, OK);
  createReceipt = (r: Parameters<InventoryServiceClient['createReceipt']>[0]) =>
    this.respond('createReceipt', r, {
      id: '', code: '', warehouse_id: '', warehouse_code: '', supplier_name: '', note: '', created_by: '',
      created_at: '', items: [], total_quantity: 0, total_cost: 0,
    });
  adjustStock = (r: Parameters<InventoryServiceClient['adjustStock']>[0]) =>
    this.respond('adjustStock', r, { stock: { sku_id: '', warehouse_id: '', on_hand: 0, reserved: 0 }, adjustment_code: '' });
  getInventoryStocks = (r: Parameters<InventoryServiceClient['getInventoryStocks']>[0]) =>
    this.respond('getInventoryStocks', r, { items: [], total: 0, page: 1, limit: 20 });
  getInventoryTransactions = (r: Parameters<InventoryServiceClient['getInventoryTransactions']>[0]) =>
    this.respond('getInventoryTransactions', r, { items: [], total: 0, page: 1, limit: 20 });
  getReceipts = (r: Parameters<InventoryServiceClient['getReceipts']>[0]) =>
    this.respond('getReceipts', r, { items: [], total: 0, page: 1, limit: 20 });
  reconcileStock = (r: Parameters<InventoryServiceClient['reconcileStock']>[0]) =>
    this.respond('reconcileStock', r, { checked: 0, drifts: [] });
}

// ---------- Fixtures ----------

let sequence = 0;

export async function createOrder(
  prisma: PrismaOrderService,
  input: { status?: OrderPrisma.OrderStatus; items?: { skuId: string; quantity: number }[] } = {},
) {
  sequence += 1;
  return prisma.order.create({
    data: {
      orderCode: `ORD-TEST-${sequence}-${Date.now()}`,
      customerId: '00000000-0000-4000-8000-000000000001',
      customerName: 'Khách Test',
      customerPhone: '0900000000',
      customerEmail: 'test@example.test',
      shippingAddress: {},
      subtotalAmount: 100000,
      totalAmount: 100000,
      orderStatus: input.status ?? 'CONFIRMED',
      items: {
        create: (input.items ?? [{ skuId: '00000000-0000-4000-8000-0000000000a1', quantity: 2 }]).map((i) => ({
          skuId: i.skuId,
          productId: '00000000-0000-4000-8000-000000000002',
          productName: 'Sản phẩm test',
          skuName: 'Biến thể test',
          unitPrice: 100000,
          quantity: i.quantity,
          totalPrice: 100000 * i.quantity,
        })),
      },
    },
    include: { items: true },
  });
}

export function skuFixture(id: string, overrides: Partial<OrderSkuDto> = {}): OrderSkuDto {
  return {
    id,
    sku_code: `SKU-${id.slice(-4)}`,
    sku_name: 'Đen',
    product_id: '00000000-0000-4000-8000-000000000002',
    product_name: 'Bàn phím Aula F75',
    product_status: 'PUBLISHED',
    price: 200000,
    is_active: true,
    thumbnail_url: 'https://example.test/sku.png',
    ...overrides,
  };
}
