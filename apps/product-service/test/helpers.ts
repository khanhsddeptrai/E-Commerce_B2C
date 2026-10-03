import Redis from 'ioredis';
import { RpcException } from '@nestjs/microservices';
import { OrderPrisma, OrderPrismaClient, ProductPrisma, ProductPrismaClient } from '@repo/database';
import { PrismaProductService } from '../src/prisma/prisma-product.service';
import { assertTestDatabaseName, getTestOrderDatabaseUrl, TEST_REDIS_DB } from './test-env';

type RawSqlClient = Pick<ProductPrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe'>;

/** Xóa sạch dữ liệu mọi bảng (giữ lịch sử migrations) — chỉ chạy trên database _test */
export async function resetTestDb(prisma: RawSqlClient): Promise<void> {
  const [row] = await prisma.$queryRawUnsafe<{ current_database: string }[]>('SELECT current_database()');
  assertTestDatabaseName(row?.current_database ?? '');

  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length === 0) return;
  const tableList = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

export const resetProductDb = (prisma: PrismaProductService): Promise<void> => resetTestDb(prisma);

export function createTestOrderPrisma(): OrderPrismaClient {
  return new OrderPrismaClient({ datasources: { db: { url: getTestOrderDatabaseUrl() } } });
}

export function createTestRedis(): Redis {
  return new Redis(process.env.REDIS_URL as string);
}

/** Xóa Redis DB dành riêng cho test — từ chối nếu không đúng DB test */
export async function flushTestRedis(redis: Redis): Promise<void> {
  if (redis.options.db !== TEST_REDIS_DB) {
    throw new Error(`Từ chối FLUSHDB trên Redis DB ${redis.options.db}: chỉ được dùng DB ${TEST_REDIS_DB} cho test`);
  }
  await redis.flushdb();
}

/** Kiểm tra promise bị từ chối bằng RpcException với đúng mã gRPC */
export async function expectRpcError(promise: Promise<unknown>, code: number, messagePattern?: RegExp): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (err: unknown) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(RpcException);
  const error = (caught as RpcException).getError() as { code: number; message: string };
  expect(error.code).toBe(code);
  if (messagePattern) expect(error.message).toMatch(messagePattern);
}

// ---------- Fixtures ----------

let sequence = 0;
function nextId(): number {
  sequence += 1;
  return sequence;
}

export async function createCategory(prisma: PrismaProductService, name = `Danh mục ${nextId()}`) {
  const n = nextId();
  return prisma.category.create({ data: { name, slug: `category-${n}` } });
}

export async function createBrand(prisma: PrismaProductService, name = `Brand ${nextId()}`) {
  const n = nextId();
  return prisma.brand.create({ data: { name, slug: `brand-${n}` } });
}

interface OrderFixtureInput {
  status: OrderPrisma.OrderStatus;
  paymentMethod: OrderPrisma.PaymentMethod;
  paymentStatus?: OrderPrisma.PaymentStatus;
  items: { skuId: string; quantity: number }[];
  /** Tạo kèm giữ hàng trong order_db (mô hình cũ) với trạng thái và hạn tương ứng */
  reservation?: { status: OrderPrisma.ReservationStatus; expiresAt: Date | null };
}

export async function createLegacyOrder(orderPrisma: OrderPrismaClient, input: OrderFixtureInput) {
  const n = nextId();
  return orderPrisma.order.create({
    data: {
      orderCode: `ORD-TEST-${n}`,
      customerId: '00000000-0000-4000-8000-000000000001',
      customerName: 'Khách Test',
      customerPhone: '0900000000',
      customerEmail: 'test@example.test',
      shippingAddress: {},
      subtotalAmount: 100000,
      totalAmount: 100000,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus ?? 'PENDING',
      orderStatus: input.status,
      items: {
        create: input.items.map((i) => ({
          skuId: i.skuId,
          productId: '00000000-0000-4000-8000-000000000002',
          productName: 'Sản phẩm test',
          skuName: 'Biến thể test',
          unitPrice: 100000,
          quantity: i.quantity,
          totalPrice: 100000 * i.quantity,
        })),
      },
      reservations: input.reservation
        ? {
            create: input.items.map((i) => ({
              skuId: i.skuId,
              quantity: i.quantity,
              status: input.reservation!.status,
              expiresAt: input.reservation!.expiresAt,
            })),
          }
        : undefined,
    },
  });
}

interface ProductFixtureInput {
  categoryId: string;
  brandId?: string;
  name?: string;
  status?: ProductPrisma.ProductStatus;
  skus?: { stock: number; skuCode?: string }[];
}

export async function createProduct(prisma: PrismaProductService, input: ProductFixtureInput) {
  const n = nextId();
  return prisma.product.create({
    data: {
      name: input.name ?? `Sản phẩm ${n}`,
      slug: `product-${n}`,
      categoryId: input.categoryId,
      brandId: input.brandId ?? null,
      description: 'Mô tả test',
      thumbnailUrl: 'https://example.test/thumb.png',
      basePrice: 100000,
      status: input.status ?? 'PUBLISHED',
      skus: {
        create: (input.skus ?? [{ stock: 10 }]).map((s, idx) => ({
          skuCode: s.skuCode ?? `SKU-${n}-${idx}`,
          name: `Biến thể ${idx + 1}`,
          colorName: 'Đen',
          colorHex: '#000000',
          price: 100000,
          stockQuantity: s.stock,
        })),
      },
    },
    include: { skus: true },
  });
}

export async function createWarehouse(prisma: PrismaProductService, isDefault = true) {
  const n = nextId();
  return prisma.warehouse.create({ data: { code: `WH-${n}`, name: `Kho ${n}`, isDefault } });
}

/** Tạo 1 SKU kèm dòng tồn tại kho cho trước */
export async function createStockedSku(
  prisma: PrismaProductService,
  warehouseId: string,
  stock: { onHand: number; reserved?: number },
) {
  const category = await createCategory(prisma);
  const product = await createProduct(prisma, { categoryId: category.id, skus: [{ stock: 0 }] });
  const sku = product.skus[0]!;
  await prisma.inventoryStock.create({
    data: { skuId: sku.id, warehouseId, onHand: stock.onHand, reserved: stock.reserved ?? 0 },
  });
  return { sku, product };
}
