import Redis from 'ioredis';
import { OrderPrismaClient } from '@repo/database';
import { backfillInventory, DEFAULT_WAREHOUSE } from '../../../../packages/database/prisma/backfill-inventory';
import { PrismaProductService } from '../../src/prisma/prisma-product.service';
import {
  createCategory,
  createLegacyOrder,
  createProduct,
  createTestOrderPrisma,
  createTestRedis,
  flushTestRedis,
  resetProductDb,
  resetTestDb,
} from '../helpers';

const NOW = new Date('2026-10-02T10:00:00Z');
const IN_10_MIN = new Date(NOW.getTime() + 10 * 60 * 1000);
const AGO_10_MIN = new Date(NOW.getTime() - 10 * 60 * 1000);

describe('backfill-inventory – chuyển tồn kho cũ sang mô hình WMS', () => {
  let productPrisma: PrismaProductService;
  let orderPrisma: OrderPrismaClient;
  let redis: Redis;

  beforeAll(async () => {
    productPrisma = new PrismaProductService();
    orderPrisma = createTestOrderPrisma();
    redis = createTestRedis();
  });

  beforeEach(async () => {
    await resetProductDb(productPrisma);
    await resetTestDb(orderPrisma);
    await flushTestRedis(redis);
  });

  afterAll(async () => {
    redis.disconnect();
    await Promise.all([productPrisma.$disconnect(), orderPrisma.$disconnect()]);
  });

  const runBackfill = () => backfillInventory({ productPrisma, orderPrisma, redis, now: NOW });

  /** Tạo 1 sản phẩm 1 SKU với tồn cũ (stock_quantity) cho trước */
  async function createSku(legacyStock: number) {
    const category = await createCategory(productPrisma);
    const product = await createProduct(productPrisma, { categoryId: category.id, skus: [{ stock: legacyStock }] });
    return product.skus[0]!.id;
  }

  async function getStock(skuId: string) {
    return productPrisma.inventoryStock.findFirstOrThrow({ where: { skuId } });
  }

  async function getRedisStock(skuId: string) {
    return Number(await redis.get(`stock:${skuId}`));
  }

  it('SKU không có đơn: on_hand = tồn cũ, ghi giao dịch tồn đầu kỳ, Redis = on_hand', async () => {
    const skuId = await createSku(10);

    const summary = await runBackfill();

    const stock = await getStock(skuId);
    expect(stock).toMatchObject({ onHand: 10, reserved: 0 });
    const txs = await productPrisma.inventoryTransaction.findMany({ where: { skuId } });
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ type: 'INBOUND', quantity: 10, balanceAfter: 10, refType: 'OPENING' });
    expect(await getRedisStock(skuId)).toBe(10);
    expect(summary).toMatchObject({ warehouseCode: DEFAULT_WAREHOUSE.code, initializedSkus: 1, skippedSkus: 0 });
  });

  it('tạo kho mặc định đánh dấu isDefault', async () => {
    await createSku(1);

    await runBackfill();

    const warehouse = await productPrisma.warehouse.findUniqueOrThrow({ where: { code: DEFAULT_WAREHOUSE.code } });
    expect(warehouse.isDefault).toBe(true);
  });

  it.each([
    ['COD (trừ tồn lúc đặt)', 'COD', 'PENDING'],
    ['VNPAY đã thanh toán (trừ tồn lúc thanh toán)', 'VNPAY', 'PAID'],
  ] as const)('đơn CONFIRMED %s: cộng lại vào on_hand và chuyển sang reserved', async (_label, method, payment) => {
    // Tồn thực tế 10, tồn cũ đã bị trừ 2 khi chốt đơn → stock_quantity = 8
    const skuId = await createSku(8);
    const order = await createLegacyOrder(orderPrisma, {
      status: 'CONFIRMED',
      paymentMethod: method,
      paymentStatus: payment,
      items: [{ skuId, quantity: 2 }],
      reservation: { status: 'COMMITTED', expiresAt: null },
    });

    await runBackfill();

    expect(await getStock(skuId)).toMatchObject({ onHand: 10, reserved: 2 });
    const reservation = await productPrisma.inventoryReservation.findFirstOrThrow({ where: { skuId } });
    expect(reservation).toMatchObject({ orderId: order.id, orderCode: order.orderCode, quantity: 2, status: 'COMMITTED' });
    expect(await getRedisStock(skuId)).toBe(8);
  });

  it('đơn VNPAY được admin xác nhận khi chưa thanh toán (lỗi #4): tồn cũ chưa bị trừ nên không cộng lại', async () => {
    const skuId = await createSku(10);
    await createLegacyOrder(orderPrisma, {
      status: 'CONFIRMED',
      paymentMethod: 'VNPAY',
      paymentStatus: 'PENDING',
      items: [{ skuId, quantity: 2 }],
    });

    await runBackfill();

    expect(await getStock(skuId)).toMatchObject({ onHand: 10, reserved: 2 });
    expect(await getRedisStock(skuId)).toBe(8);
  });

  it('đơn PENDING còn hạn giữ hàng: chép reservation HOLD, Redis trừ phần đang giữ', async () => {
    const skuId = await createSku(10);
    await createLegacyOrder(orderPrisma, {
      status: 'PENDING',
      paymentMethod: 'VNPAY',
      items: [{ skuId, quantity: 3 }],
      reservation: { status: 'HOLD', expiresAt: IN_10_MIN },
    });

    const summary = await runBackfill();

    expect(await getStock(skuId)).toMatchObject({ onHand: 10, reserved: 0 });
    const reservation = await productPrisma.inventoryReservation.findFirstOrThrow({ where: { skuId } });
    expect(reservation).toMatchObject({ quantity: 3, status: 'HOLD' });
    expect(reservation.expiresAt).toEqual(IN_10_MIN);
    expect(await getRedisStock(skuId)).toBe(7);
    expect(summary.holdReservations).toBe(1);
  });

  it('đơn PENDING đã quá hạn giữ hàng: bỏ qua', async () => {
    const skuId = await createSku(10);
    await createLegacyOrder(orderPrisma, {
      status: 'PENDING',
      paymentMethod: 'VNPAY',
      items: [{ skuId, quantity: 3 }],
      reservation: { status: 'HOLD', expiresAt: AGO_10_MIN },
    });

    await runBackfill();

    expect(await productPrisma.inventoryReservation.count()).toBe(0);
    expect(await getRedisStock(skuId)).toBe(10);
  });

  it.each(['SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNED'] as const)(
    'đơn %s: không ảnh hưởng tồn (hàng đã rời kho hoặc đã được hoàn)',
    async (status) => {
      const skuId = await createSku(10);
      await createLegacyOrder(orderPrisma, {
        status,
        paymentMethod: 'COD',
        paymentStatus: 'PAID',
        items: [{ skuId, quantity: 2 }],
        reservation: { status: 'COMMITTED', expiresAt: null },
      });

      await runBackfill();

      expect(await getStock(skuId)).toMatchObject({ onHand: 10, reserved: 0 });
      expect(await productPrisma.inventoryReservation.count()).toBe(0);
    },
  );

  it('một đơn nhiều SKU và nhiều đơn cùng SKU được cộng dồn đúng', async () => {
    const skuA = await createSku(5); // thực tế 5 + 1 + 2 = 8
    const skuB = await createSku(4); // thực tế 4 + 3 = 7
    await createLegacyOrder(orderPrisma, {
      status: 'CONFIRMED',
      paymentMethod: 'COD',
      items: [
        { skuId: skuA, quantity: 1 },
        { skuId: skuB, quantity: 3 },
      ],
    });
    await createLegacyOrder(orderPrisma, {
      status: 'CONFIRMED',
      paymentMethod: 'COD',
      items: [{ skuId: skuA, quantity: 2 }],
    });

    await runBackfill();

    expect(await getStock(skuA)).toMatchObject({ onHand: 8, reserved: 3 });
    expect(await getStock(skuB)).toMatchObject({ onHand: 7, reserved: 3 });
    expect(await productPrisma.inventoryReservation.count({ where: { skuId: skuA } })).toBe(2);
    expect(await getRedisStock(skuA)).toBe(5);
    expect(await getRedisStock(skuB)).toBe(4);
  });

  it('SKU hết hàng (tồn 0): tạo dòng tồn nhưng không ghi giao dịch tồn đầu kỳ', async () => {
    const skuId = await createSku(0);

    await runBackfill();

    expect(await getStock(skuId)).toMatchObject({ onHand: 0, reserved: 0 });
    expect(await productPrisma.inventoryTransaction.count({ where: { skuId } })).toBe(0);
    expect(await getRedisStock(skuId)).toBe(0);
  });

  it('chạy lại: không tạo trùng, chỉ khởi tạo SKU mới thêm sau lần chạy trước', async () => {
    const skuA = await createSku(10);
    await createLegacyOrder(orderPrisma, {
      status: 'CONFIRMED',
      paymentMethod: 'COD',
      items: [{ skuId: skuA, quantity: 2 }],
    });
    await runBackfill();

    const skuB = await createSku(6);
    const second = await runBackfill();

    expect(second).toMatchObject({ initializedSkus: 1, skippedSkus: 1, committedReservations: 0 });
    expect(await getStock(skuA)).toMatchObject({ onHand: 12, reserved: 2 });
    expect(await getStock(skuB)).toMatchObject({ onHand: 6, reserved: 0 });
    expect(await productPrisma.inventoryStock.count()).toBe(2);
    expect(await productPrisma.inventoryReservation.count()).toBe(1);
    expect(await productPrisma.inventoryTransaction.count()).toBe(2);
    expect(await getRedisStock(skuA)).toBe(10);
    expect(await getRedisStock(skuB)).toBe(6);
  });

  it('database chặn tồn âm bằng ràng buộc CHECK', async () => {
    const skuId = await createSku(1);
    await runBackfill();

    await expect(
      productPrisma.inventoryStock.updateMany({ where: { skuId }, data: { onHand: { decrement: 5 } } }),
    ).rejects.toThrow(/inventory_stocks_on_hand_non_negative/);
  });
});
