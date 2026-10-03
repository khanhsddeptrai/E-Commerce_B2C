import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { status } from '@grpc/grpc-js';
import { InventoryService } from '../../src/inventory/inventory.service';
import { PrismaProductService } from '../../src/prisma/prisma-product.service';
import {
  createStockedSku,
  createTestRedis,
  createWarehouse,
  expectRpcError,
  flushTestRedis,
  resetProductDb,
} from '../helpers';

/** Mỗi test tạo service mới để không dùng lại kho mặc định đã cache từ test trước */
describe('InventoryService – giữ / chốt / nhả / xuất hàng theo đơn', () => {
  let prisma: PrismaProductService;
  let redis: Redis;
  let service: InventoryService;
  let warehouseId: string;

  beforeAll(async () => {
    prisma = new PrismaProductService();
    await prisma.$connect();
    redis = createTestRedis();
  });

  beforeEach(async () => {
    await resetProductDb(prisma);
    await flushTestRedis(redis);
    service = new InventoryService(prisma);
    warehouseId = (await createWarehouse(prisma)).id;
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  afterAll(async () => {
    redis.disconnect();
    await prisma.$disconnect();
  });

  const newOrder = () => {
    const id = randomUUID();
    return { order_id: id, order_code: `ORD-${id.slice(0, 8)}` };
  };

  async function skuWithStock(onHand: number, reserved = 0) {
    return (await createStockedSku(prisma, warehouseId, { onHand, reserved })).sku.id;
  }

  const redisStock = async (skuId: string) => {
    const value = await redis.get(`stock:${skuId}`);
    return value === null ? null : Number(value);
  };

  const stockRow = (skuId: string) => prisma.inventoryStock.findFirstOrThrow({ where: { skuId } });

  const reservationsOf = (orderId: string) =>
    prisma.inventoryReservation.findMany({ where: { orderId }, orderBy: { skuId: 'asc' } });

  /** Bất biến: Redis luôn bằng on_hand − reserved − HOLD chưa nhả */
  async function expectRedisConsistent(skuId: string) {
    const stock = await stockRow(skuId);
    const held = await prisma.inventoryReservation.aggregate({
      where: { skuId, status: 'HOLD' },
      _sum: { quantity: true },
    });
    expect(await redisStock(skuId)).toBe(stock.onHand - stock.reserved - (held._sum.quantity ?? 0));
  }

  // ---------- GetSkusForOrder ----------

  describe('getSkusForOrder', () => {
    it('trả thông tin SKU kèm sản phẩm để Order Service tính giá', async () => {
      const { sku, product } = await createStockedSku(prisma, warehouseId, { onHand: 5 });

      const res = await service.getSkusForOrder({ sku_ids: [sku.id, sku.id] });

      expect(res.skus).toHaveLength(1);
      expect(res.skus[0]).toMatchObject({
        id: sku.id,
        sku_code: sku.skuCode,
        product_id: product.id,
        product_name: product.name,
        product_status: 'PUBLISHED',
        price: 100000,
        is_active: true,
      });
    });
  });

  // ---------- HoldStock ----------

  describe('holdStock', () => {
    it('giữ hàng: trừ Redis, tạo reservation HOLD có hạn, không đổi on_hand / reserved', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      const before = Date.now();

      const res = await service.holdStock({ ...order, items: [{ sku_id: skuId, quantity: 3 }], ttl_seconds: 600 });

      expect(res).toMatchObject({ success: true, already_processed: false });
      expect(await redisStock(skuId)).toBe(7);
      expect(await stockRow(skuId)).toMatchObject({ onHand: 10, reserved: 0 });
      const [reservation] = await reservationsOf(order.order_id);
      expect(reservation).toMatchObject({ status: 'HOLD', quantity: 3, orderCode: order.order_code });
      const ttlMs = reservation!.expiresAt!.getTime() - before;
      expect(ttlMs).toBeGreaterThanOrEqual(600_000 - 1000);
      expect(ttlMs).toBeLessThanOrEqual(600_000 + 5000);
    });

    it('khởi tạo key Redis còn thiếu từ database (on_hand − reserved − HOLD chưa nhả)', async () => {
      const skuId = await skuWithStock(10, 2);
      await service.holdStock({ ...newOrder(), items: [{ sku_id: skuId, quantity: 1 }] });
      await redis.del(`stock:${skuId}`); // mô phỏng Redis mất dữ liệu

      await service.holdStock({ ...newOrder(), items: [{ sku_id: skuId, quantity: 1 }] });

      // 10 − 2 − 1 (HOLD cũ) − 1 (HOLD mới)
      expect(await redisStock(skuId)).toBe(6);
      await expectRedisConsistent(skuId);
    });

    it('nhiều SKU nguyên tử: một SKU thiếu hàng thì không giữ SKU nào', async () => {
      const skuA = await skuWithStock(10);
      const skuB = await skuWithStock(1);
      const order = newOrder();

      await expectRpcError(
        service.holdStock({
          ...order,
          items: [
            { sku_id: skuA, quantity: 2 },
            { sku_id: skuB, quantity: 5 },
          ],
        }),
        status.RESOURCE_EXHAUSTED,
        /không đủ số lượng tồn kho/,
      );

      expect(await redisStock(skuA)).toBe(10);
      expect(await redisStock(skuB)).toBe(1);
      expect(await reservationsOf(order.order_id)).toHaveLength(0);
    });

    it('gọi lại cùng đơn: không giữ hàng hai lần', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      const input = { ...order, items: [{ sku_id: skuId, quantity: 3 }] };

      await service.holdStock(input);
      const second = await service.holdStock(input);

      expect(second.already_processed).toBe(true);
      expect(await redisStock(skuId)).toBe(7);
      expect(await reservationsOf(order.order_id)).toHaveLength(1);
    });

    it('cùng một đơn gửi giữ hàng đồng thời: chỉ giữ một lần', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      const input = { ...order, items: [{ sku_id: skuId, quantity: 2 }] };

      const results = await Promise.all(Array.from({ length: 5 }, () => service.holdStock(input)));

      expect(results.filter((r) => !r.already_processed)).toHaveLength(1);
      expect(await redisStock(skuId)).toBe(8);
      expect(await reservationsOf(order.order_id)).toHaveLength(1);
    });

    it('nhiều khách tranh hàng cùng lúc: tổng giữ không vượt tồn', async () => {
      const skuId = await skuWithStock(3);

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => service.holdStock({ ...newOrder(), items: [{ sku_id: skuId, quantity: 1 }] })),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
      expect(await redisStock(skuId)).toBe(0);
      expect(await prisma.inventoryReservation.count({ where: { skuId, status: 'HOLD' } })).toBe(3);
    });

    it('gộp SKU trùng trong cùng đơn', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();

      await service.holdStock({
        ...order,
        items: [
          { sku_id: skuId, quantity: 1 },
          { sku_id: skuId, quantity: 2 },
        ],
      });

      const reservations = await reservationsOf(order.order_id);
      expect(reservations).toHaveLength(1);
      expect(reservations[0]!.quantity).toBe(3);
      expect(await redisStock(skuId)).toBe(7);
    });

    it.each([0, -1, 1.5])('số lượng không hợp lệ (%p): INVALID_ARGUMENT', async (quantity) => {
      const skuId = await skuWithStock(10);

      await expectRpcError(
        service.holdStock({ ...newOrder(), items: [{ sku_id: skuId, quantity }] }),
        status.INVALID_ARGUMENT,
      );
    });

    it('chưa có kho mặc định: FAILED_PRECONDITION', async () => {
      const skuId = await skuWithStock(10);
      await prisma.warehouse.updateMany({ data: { isDefault: false } });

      await expectRpcError(
        service.holdStock({ ...newOrder(), items: [{ sku_id: skuId, quantity: 1 }] }),
        status.FAILED_PRECONDITION,
        /kho mặc định/,
      );
    });
  });

  // ---------- CommitStock ----------

  describe('commitStock', () => {
    it('đơn đã giữ hàng: HOLD → COMMITTED, reserved tăng, Redis không đổi', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.holdStock({ ...order, items: [{ sku_id: skuId, quantity: 3 }] });

      const res = await service.commitStock({ ...order, items: [] });

      expect(res.already_processed).toBe(false);
      expect(await stockRow(skuId)).toMatchObject({ onHand: 10, reserved: 3 });
      expect(await redisStock(skuId)).toBe(7);
      const [reservation] = await reservationsOf(order.order_id);
      expect(reservation).toMatchObject({ status: 'COMMITTED', expiresAt: null });
      await expectRedisConsistent(skuId);
    });

    it('chốt đồng thời nhiều lần (IPN + trang kết quả): reserved chỉ tăng một lần', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.holdStock({ ...order, items: [{ sku_id: skuId, quantity: 3 }] });

      const results = await Promise.all(Array.from({ length: 5 }, () => service.commitStock({ ...order, items: [] })));

      expect(results.filter((r) => !r.already_processed)).toHaveLength(1);
      expect(await stockRow(skuId)).toMatchObject({ reserved: 3 });
      await expectRedisConsistent(skuId);
    });

    it('đơn COD (chưa giữ hàng): giữ trực tiếp theo items và chốt luôn', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();

      await service.commitStock({ ...order, items: [{ sku_id: skuId, quantity: 4 }] });

      expect(await stockRow(skuId)).toMatchObject({ onHand: 10, reserved: 4 });
      expect(await redisStock(skuId)).toBe(6);
      expect(await reservationsOf(order.order_id)).toEqual([
        expect.objectContaining({ status: 'COMMITTED', quantity: 4 }),
      ]);
    });

    it('đơn COD không đủ hàng: RESOURCE_EXHAUSTED, không thay đổi gì', async () => {
      const skuId = await skuWithStock(2);
      const order = newOrder();

      await expectRpcError(
        service.commitStock({ ...order, items: [{ sku_id: skuId, quantity: 3 }] }),
        status.RESOURCE_EXHAUSTED,
      );

      expect(await stockRow(skuId)).toMatchObject({ reserved: 0 });
      expect(await redisStock(skuId)).toBe(2);
      expect(await reservationsOf(order.order_id)).toHaveLength(0);
    });

    it('đơn COD gửi chốt đồng thời: chỉ giữ và chốt một lần', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      const input = { ...order, items: [{ sku_id: skuId, quantity: 2 }] };

      const results = await Promise.all(Array.from({ length: 5 }, () => service.commitStock(input)));

      expect(results.filter((r) => !r.already_processed)).toHaveLength(1);
      expect(await stockRow(skuId)).toMatchObject({ reserved: 2 });
      expect(await redisStock(skuId)).toBe(8);
      await expectRedisConsistent(skuId);
    });

    it('giữ hàng đã bị nhả do hết hạn nhưng vẫn còn hàng: giữ lại và chốt (mục 5.1c)', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      const items = [{ sku_id: skuId, quantity: 3 }];
      await service.holdStock({ ...order, items });
      await service.releaseStock({ order_id: order.order_id, reason: 'Hết hạn' });

      const res = await service.commitStock({ ...order, items });

      expect(res.already_processed).toBe(false);
      expect(await stockRow(skuId)).toMatchObject({ reserved: 3 });
      expect(await reservationsOf(order.order_id)).toEqual([
        expect.objectContaining({ status: 'COMMITTED', quantity: 3 }),
      ]);
      await expectRedisConsistent(skuId);
    });

    it('giữ hàng đã bị nhả và hàng đã bán hết cho người khác: RESOURCE_EXHAUSTED (mục 5.1c)', async () => {
      const skuId = await skuWithStock(3);
      const order = newOrder();
      const items = [{ sku_id: skuId, quantity: 3 }];
      await service.holdStock({ ...order, items });
      await service.releaseStock({ order_id: order.order_id, reason: 'Hết hạn' });
      await service.commitStock({ ...newOrder(), items }); // khách khác mua hết

      await expectRpcError(service.commitStock({ ...order, items }), status.RESOURCE_EXHAUSTED);

      expect(await reservationsOf(order.order_id)).toEqual([expect.objectContaining({ status: 'RELEASED' })]);
      await expectRedisConsistent(skuId);
    });

    it('chưa giữ hàng và không gửi items: INVALID_ARGUMENT', async () => {
      await expectRpcError(service.commitStock({ ...newOrder(), items: [] }), status.INVALID_ARGUMENT);
    });
  });

  // ---------- ReleaseStock ----------

  describe('releaseStock', () => {
    it('nhả HOLD: cộng trả Redis, reserved không đổi', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.holdStock({ ...order, items: [{ sku_id: skuId, quantity: 3 }] });

      const res = await service.releaseStock({ order_id: order.order_id, reason: 'Thanh toán thất bại' });

      expect(res.already_processed).toBe(false);
      expect(await redisStock(skuId)).toBe(10);
      expect(await stockRow(skuId)).toMatchObject({ reserved: 0 });
      expect(await reservationsOf(order.order_id)).toEqual([expect.objectContaining({ status: 'RELEASED' })]);
    });

    it('nhả đơn đã chốt chưa xuất kho (vd hủy đơn COD – lỗi #3): reserved giảm, Redis được cộng trả', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.commitStock({ ...order, items: [{ sku_id: skuId, quantity: 4 }] });

      await service.releaseStock({ order_id: order.order_id, reason: 'Khách hủy' });

      expect(await stockRow(skuId)).toMatchObject({ onHand: 10, reserved: 0 });
      expect(await redisStock(skuId)).toBe(10);
    });

    it('nhả đồng thời nhiều lần (worker hết hạn + khách hủy): chỉ cộng trả một lần', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.holdStock({ ...order, items: [{ sku_id: skuId, quantity: 3 }] });

      const results = await Promise.all(
        Array.from({ length: 5 }, () => service.releaseStock({ order_id: order.order_id, reason: 'test' })),
      );

      expect(results.filter((r) => !r.already_processed)).toHaveLength(1);
      expect(await redisStock(skuId)).toBe(10);
    });

    it('Redis mất key lúc nhả: không tạo key sai, lần giữ sau khởi tạo đúng từ database', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.holdStock({ ...order, items: [{ sku_id: skuId, quantity: 3 }] });
      await redis.del(`stock:${skuId}`);

      await service.releaseStock({ order_id: order.order_id, reason: 'test' });

      expect(await redisStock(skuId)).toBeNull();
      await service.holdStock({ ...newOrder(), items: [{ sku_id: skuId, quantity: 1 }] });
      expect(await redisStock(skuId)).toBe(9);
    });

    it('đơn đã xuất kho: FAILED_PRECONDITION (phải dùng nhận hàng hoàn)', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.commitStock({ ...order, items: [{ sku_id: skuId, quantity: 1 }] });
      await service.shipStock({ order_id: order.order_id, performed_by: 'ADMIN_test' });

      await expectRpcError(
        service.releaseStock({ order_id: order.order_id, reason: 'test' }),
        status.FAILED_PRECONDITION,
        /nhận hàng hoàn/,
      );
    });

    it('đơn chưa có giữ hàng: thành công, không làm gì', async () => {
      const res = await service.releaseStock({ order_id: randomUUID(), reason: 'test' });

      expect(res).toMatchObject({ success: true, already_processed: true });
    });
  });

  // ---------- ShipStock ----------

  describe('shipStock', () => {
    it('xuất kho: on_hand và reserved cùng giảm, ghi sổ OUTBOUND, Redis không đổi', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.commitStock({ ...order, items: [{ sku_id: skuId, quantity: 4 }] });

      const res = await service.shipStock({ order_id: order.order_id, performed_by: 'ADMIN_a@test' });

      expect(res.already_processed).toBe(false);
      expect(await stockRow(skuId)).toMatchObject({ onHand: 6, reserved: 0 });
      expect(await redisStock(skuId)).toBe(6);
      const txs = await prisma.inventoryTransaction.findMany({ where: { skuId } });
      expect(txs).toEqual([
        expect.objectContaining({
          type: 'OUTBOUND',
          quantity: -4,
          balanceAfter: 6,
          refType: 'ORDER',
          refId: order.order_code,
          createdBy: 'ADMIN_a@test',
        }),
      ]);
      expect(await reservationsOf(order.order_id)).toEqual([expect.objectContaining({ status: 'SHIPPED' })]);
      await expectRedisConsistent(skuId);
    });

    it('xuất kho đồng thời nhiều lần: chỉ trừ tồn và ghi sổ một lần', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.commitStock({ ...order, items: [{ sku_id: skuId, quantity: 4 }] });

      const results = await Promise.all(
        Array.from({ length: 5 }, () => service.shipStock({ order_id: order.order_id, performed_by: 'SYSTEM' })),
      );

      expect(results.filter((r) => !r.already_processed)).toHaveLength(1);
      expect(await stockRow(skuId)).toMatchObject({ onHand: 6, reserved: 0 });
      expect(await prisma.inventoryTransaction.count({ where: { skuId } })).toBe(1);
    });

    it('đơn mới giữ hàng, chưa chốt: FAILED_PRECONDITION', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.holdStock({ ...order, items: [{ sku_id: skuId, quantity: 1 }] });

      await expectRpcError(
        service.shipStock({ order_id: order.order_id, performed_by: 'SYSTEM' }),
        status.FAILED_PRECONDITION,
        /chưa được chốt/,
      );
    });

    it('đơn đã nhả hàng: FAILED_PRECONDITION', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.commitStock({ ...order, items: [{ sku_id: skuId, quantity: 1 }] });
      await service.releaseStock({ order_id: order.order_id, reason: 'Hủy' });

      await expectRpcError(
        service.shipStock({ order_id: order.order_id, performed_by: 'SYSTEM' }),
        status.FAILED_PRECONDITION,
      );
    });

    it('đơn không tồn tại trong kho: NOT_FOUND', async () => {
      await expectRpcError(
        service.shipStock({ order_id: randomUUID(), performed_by: 'SYSTEM' }),
        status.NOT_FOUND,
      );
    });
  });

  // ---------- Vòng đời đầy đủ ----------

  it('vòng đời nhiều đơn đan xen: Redis luôn khớp công thức, tồn không âm', async () => {
    const skuId = await skuWithStock(10);
    const a = newOrder(); // VNPAY: giữ → thanh toán → xuất kho
    const b = newOrder(); // VNPAY: giữ → hết hạn
    const c = newOrder(); // COD: chốt → hủy
    const d = newOrder(); // COD: chốt → xuất kho

    await service.holdStock({ ...a, items: [{ sku_id: skuId, quantity: 2 }] });
    await service.holdStock({ ...b, items: [{ sku_id: skuId, quantity: 3 }] });
    await service.commitStock({ ...c, items: [{ sku_id: skuId, quantity: 1 }] });
    await service.commitStock({ ...a, items: [] });
    await service.releaseStock({ order_id: b.order_id, reason: 'Hết hạn' });
    await service.commitStock({ ...d, items: [{ sku_id: skuId, quantity: 4 }] });
    await service.releaseStock({ order_id: c.order_id, reason: 'Khách hủy' });
    await service.shipStock({ order_id: a.order_id, performed_by: 'SYSTEM' });
    await service.shipStock({ order_id: d.order_id, performed_by: 'SYSTEM' });

    expect(await stockRow(skuId)).toMatchObject({ onHand: 4, reserved: 0 });
    expect(await redisStock(skuId)).toBe(4);
    await expectRedisConsistent(skuId);
  });
});
