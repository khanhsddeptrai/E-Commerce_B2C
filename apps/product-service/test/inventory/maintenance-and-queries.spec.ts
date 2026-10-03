import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { status } from '@grpc/grpc-js';
import { CatalogService } from '../../src/catalog/catalog.service';
import { InventoryQueryService } from '../../src/inventory/inventory-query.service';
import { InventoryService } from '../../src/inventory/inventory.service';
import { PrismaProductService } from '../../src/prisma/prisma-product.service';
import {
  createCategory,
  createProduct,
  createStockedSku,
  createTestRedis,
  createWarehouse,
  expectRpcError,
  flushTestRedis,
  resetProductDb,
} from '../helpers';

const IN_FUTURE = () => new Date(Date.now() + 60 * 60 * 1000);

describe('InventoryService – bảo trì & truy vấn', () => {
  let prisma: PrismaProductService;
  let redis: Redis;
  let service: InventoryService;
  let query: InventoryQueryService;
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
    query = new InventoryQueryService(prisma);
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

  async function sku(onHand: number, opts: { reserved?: number; productName?: string } = {}) {
    const category = await createCategory(prisma);
    const product = await createProduct(prisma, {
      categoryId: category.id,
      name: opts.productName,
      skus: [{ stock: 0 }],
    });
    const created = product.skus[0]!;
    await prisma.inventoryStock.create({
      data: { skuId: created.id, warehouseId, onHand, reserved: opts.reserved ?? 0 },
    });
    return created;
  }

  const redisStock = async (skuId: string) => {
    const value = await redis.get(`stock:${skuId}`);
    return value === null ? null : Number(value);
  };

  // ---------- releaseExpiredHolds ----------

  describe('releaseExpiredHolds', () => {
    it('nhả HOLD quá hạn và cộng trả Redis; HOLD còn hạn giữ nguyên', async () => {
      const { id: skuId } = await sku(10);
      const expired = newOrder();
      const active = newOrder();
      await service.holdStock({ ...expired, items: [{ sku_id: skuId, quantity: 3 }], ttl_seconds: 1 });
      await service.holdStock({ ...active, items: [{ sku_id: skuId, quantity: 2 }], ttl_seconds: 3600 });

      const count = await service.releaseExpiredHolds(new Date(Date.now() + 5000));

      expect(count).toBe(1);
      expect(await redisStock(skuId)).toBe(8);
      const statuses = await prisma.inventoryReservation.findMany({ select: { orderId: true, status: true } });
      expect(statuses).toEqual(
        expect.arrayContaining([
          { orderId: expired.order_id, status: 'RELEASED' },
          { orderId: active.order_id, status: 'HOLD' },
        ]),
      );
    });

    it('không đụng vào đơn đã được chốt dù thời điểm giữ hàng đã qua', async () => {
      const { id: skuId } = await sku(10);
      const order = newOrder();
      await service.holdStock({ ...order, items: [{ sku_id: skuId, quantity: 3 }], ttl_seconds: 1 });
      await service.commitStock({ ...order, items: [] });

      const count = await service.releaseExpiredHolds(new Date(Date.now() + 5000));

      expect(count).toBe(0);
      expect(await prisma.inventoryStock.findFirstOrThrow({ where: { skuId } })).toMatchObject({ reserved: 3 });
      expect(await redisStock(skuId)).toBe(7);
    });

    it('chạy đồng thời nhiều lần: chỉ cộng trả một lần', async () => {
      const { id: skuId } = await sku(10);
      await service.holdStock({ ...newOrder(), items: [{ sku_id: skuId, quantity: 4 }], ttl_seconds: 1 });
      const later = new Date(Date.now() + 5000);

      const counts = await Promise.all(Array.from({ length: 4 }, () => service.releaseExpiredHolds(later)));

      expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
      expect(await redisStock(skuId)).toBe(10);
    });
  });

  // ---------- reconcileStock ----------

  describe('reconcileStock', () => {
    it('sửa key lệch / thiếu, bỏ qua key đúng, tính trừ phần đang giữ', async () => {
      const ok = await sku(10);
      const wrong = await sku(10, { reserved: 2 });
      const missing = await sku(6);
      await service.holdStock({ ...newOrder(), items: [{ sku_id: ok.id, quantity: 1 }] }); // Redis ok = 9 (đúng)
      await redis.set(`stock:${wrong.id}`, 99); // đúng ra 8

      const res = await service.reconcileStock({ sku_ids: [] });

      expect(res.checked).toBe(3);
      expect(res.drifts).toEqual(
        expect.arrayContaining([
          { sku_id: wrong.id, redis_before: 99, expected: 8 },
          { sku_id: missing.id, redis_before: undefined, expected: 6 },
        ]),
      );
      expect(res.drifts).toHaveLength(2);
      expect(await redisStock(ok.id)).toBe(9);
      expect(await redisStock(wrong.id)).toBe(8);
      expect(await redisStock(missing.id)).toBe(6);
    });

    it('chỉ đối soát các SKU được chỉ định', async () => {
      const a = await sku(5);
      const b = await sku(5);

      const res = await service.reconcileStock({ sku_ids: [a.id] });

      expect(res.checked).toBe(1);
      expect(await redisStock(a.id)).toBe(5);
      expect(await redisStock(b.id)).toBeNull();
    });
  });

  // ---------- getAvailableStocks ----------

  describe('getAvailableStocks', () => {
    it('trả số còn bán được, khởi tạo key thiếu từ inventory_stocks', async () => {
      const a = await sku(10, { reserved: 4 });

      const map = await service.getAvailableStocks([a.id]);

      expect(map.get(a.id)).toBe(6);
      expect(await redisStock(a.id)).toBe(6);
    });

    it('Redis lỗi: tính số còn bán được trực tiếp từ database', async () => {
      const a = await sku(10, { reserved: 3 });
      const fresh = new InventoryService(prisma);
      fresh.onModuleDestroy(); // đóng kết nối Redis → mọi lệnh Redis bị từ chối

      const map = await fresh.getAvailableStocks([a.id, randomUUID()]);

      expect(map.get(a.id)).toBe(7);
      expect([...map.values()]).toEqual([7, 0]);
    });
  });

  // ---------- Truy vấn ----------

  describe('getInventoryStocks', () => {
    it('phân trang, sắp xếp còn bán được tăng dần, tính cả phần đang giữ', async () => {
      const low = await sku(3);
      const mid = await sku(20, { reserved: 5 });
      const high = await sku(100);
      await service.holdStock({ ...newOrder(), items: [{ sku_id: mid.id, quantity: 4 }] });

      const page1 = await query.getInventoryStocks({ page: 1, limit: 2 });
      const page2 = await query.getInventoryStocks({ page: 2, limit: 2 });

      expect(page1).toMatchObject({ total: 3, page: 1, limit: 2 });
      expect(page1.items.map((i) => i.sku_id)).toEqual([low.id, mid.id]);
      expect(page1.items[1]).toMatchObject({ on_hand: 20, reserved: 5, held: 4, available: 11 });
      expect(page2.items.map((i) => i.sku_id)).toEqual([high.id]);
    });

    it('lọc hàng sắp hết (≤ ngưỡng) và tìm theo tên sản phẩm', async () => {
      await sku(3, { productName: 'Bàn phím Aula F75' });
      await sku(50, { productName: 'Bàn phím Aula F99' });
      await sku(2, { productName: 'Chuột Logitech' });

      const lowStock = await query.getInventoryStocks({ low_stock_only: true, low_stock_threshold: 5 });
      const lowAula = await query.getInventoryStocks({ low_stock_only: true, search: 'aula' });

      expect(lowStock.total).toBe(2);
      expect(lowAula.total).toBe(1);
      expect(lowAula.items[0]!.product_name).toBe('Bàn phím Aula F75');
    });

    it('trang vượt quá dữ liệu: items rỗng nhưng total vẫn đúng', async () => {
      await sku(1);

      const res = await query.getInventoryStocks({ page: 5, limit: 10 });

      expect(res).toMatchObject({ items: [], total: 1, page: 5 });
    });
  });

  describe('getInventoryTransactions', () => {
    it('lọc theo loại / SKU / chứng từ, mới nhất lên đầu, có phân trang', async () => {
      const a = await sku(10);
      const b = await sku(10);
      const receipt = await service.createReceipt({
        supplier_name: 'NCC',
        note: '',
        created_by: 'ADMIN',
        items: [
          { sku_id: a.id, quantity: 5, cost_price: 1 },
          { sku_id: b.id, quantity: 5, cost_price: 1 },
        ],
      });
      await service.adjustStock({ sku_id: a.id, quantity_delta: -2, reason: 'Hỏng', created_by: 'ADMIN' });

      const all = await query.getInventoryTransactions({});
      const inbound = await query.getInventoryTransactions({ type: 'INBOUND' });
      const skuA = await query.getInventoryTransactions({ sku_id: a.id, limit: 1 });
      const byRef = await query.getInventoryTransactions({ ref_id: receipt.code });

      expect(all.total).toBe(3);
      expect(all.items[0]).toMatchObject({ type: 'ADJUSTMENT', quantity: -2, sku_code: a.skuCode });
      expect(inbound.total).toBe(2);
      expect(skuA).toMatchObject({ total: 2, limit: 1 });
      expect(skuA.items).toHaveLength(1);
      expect(byRef.total).toBe(2);
    });

    it('lọc theo khoảng thời gian', async () => {
      const a = await sku(10);
      await service.adjustStock({ sku_id: a.id, quantity_delta: 1, reason: 'x', created_by: 'ADMIN' });

      const future = await query.getInventoryTransactions({ from: IN_FUTURE().toISOString() });
      const past = await query.getInventoryTransactions({ to: IN_FUTURE().toISOString() });

      expect(future.total).toBe(0);
      expect(past.total).toBe(1);
    });

    it('loại giao dịch hoặc thời gian không hợp lệ: INVALID_ARGUMENT', async () => {
      await expectRpcError(query.getInventoryTransactions({ type: 'SOLD' }), status.INVALID_ARGUMENT);
      await expectRpcError(query.getInventoryTransactions({ from: 'không-phải-ngày' }), status.INVALID_ARGUMENT);
    });
  });

  describe('getReceipts', () => {
    it('tìm theo mã phiếu hoặc nhà cung cấp, có phân trang', async () => {
      const a = await sku(0);
      const first = await service.createReceipt({ supplier_name: 'Aula Việt Nam', note: '', created_by: 'ADMIN', items: [{ sku_id: a.id, quantity: 1, cost_price: 1 }] });
      await service.createReceipt({ supplier_name: 'Logitech', note: '', created_by: 'ADMIN', items: [{ sku_id: a.id, quantity: 2, cost_price: 1 }] });

      const all = await query.getReceipts({ limit: 1 });
      const bySupplier = await query.getReceipts({ search: 'aula' });
      const byCode = await query.getReceipts({ search: first.code });

      expect(all).toMatchObject({ total: 2, limit: 1 });
      expect(all.items).toHaveLength(1);
      expect(bySupplier.items.map((r) => r.code)).toEqual([first.code]);
      expect(byCode.total).toBe(1);
      expect(byCode.items[0]!.items[0]).toMatchObject({ sku_id: a.id, quantity: 1 });
    });
  });

  // ---------- Catalog đọc tồn ----------

  it('Catalog hiển thị số còn bán được từ inventory_stocks', async () => {
    const category = await createCategory(prisma);
    const product = await createProduct(prisma, { categoryId: category.id, skus: [{ stock: 0 }] });
    const skuId = product.skus[0]!.id;
    await prisma.inventoryStock.create({ data: { skuId, warehouseId, onHand: 10, reserved: 3 } });
    const catalog = new CatalogService(prisma, service);

    const res = await catalog.getAdminProducts({});

    expect(res.products[0]!.variants[0]!.stock_quantity).toBe(7);
  });
});
