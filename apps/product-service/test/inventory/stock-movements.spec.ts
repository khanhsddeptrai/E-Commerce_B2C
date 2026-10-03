import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { status } from '@grpc/grpc-js';
import { CatalogService } from '../../src/catalog/catalog.service';
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

describe('InventoryService – nhập kho, điều chỉnh, hàng hoàn', () => {
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

  async function expectRedisConsistent(skuId: string) {
    const stock = await stockRow(skuId);
    const held = await prisma.inventoryReservation.aggregate({
      where: { skuId, status: 'HOLD' },
      _sum: { quantity: true },
    });
    expect(await redisStock(skuId)).toBe(stock.onHand - stock.reserved - (held._sum.quantity ?? 0));
  }

  /** Bán và xuất kho một đơn để có hàng hoàn */
  async function shippedOrder(skuId: string, quantity: number) {
    const order = newOrder();
    await service.commitStock({ ...order, items: [{ sku_id: skuId, quantity }] });
    await service.shipStock({ order_id: order.order_id, performed_by: 'SYSTEM' });
    return order;
  }

  // ---------- CreateReceipt ----------

  describe('createReceipt', () => {
    it('nhập kho nhiều SKU: on_hand tăng, ghi sổ INBOUND, Redis tăng, trả tổng số lượng / giá vốn', async () => {
      const skuA = await skuWithStock(5);
      const skuB = await skuWithStock(0);
      await redis.set(`stock:${skuA}`, 5);

      const receipt = await service.createReceipt({
        supplier_name: 'Công ty Aula VN',
        note: 'Lô tháng 10',
        created_by: 'ADMIN_a@test',
        items: [
          { sku_id: skuA, quantity: 10, cost_price: 200000 },
          { sku_id: skuB, quantity: 3, cost_price: 150000 },
        ],
      });

      expect(receipt.code).toMatch(/^GRN-\d{6}-[A-Z0-9]{4}$/);
      expect(receipt).toMatchObject({ total_quantity: 13, total_cost: 2_450_000, supplier_name: 'Công ty Aula VN' });
      expect(receipt.items).toHaveLength(2);
      expect(await stockRow(skuA)).toMatchObject({ onHand: 15 });
      expect(await stockRow(skuB)).toMatchObject({ onHand: 3 });
      expect(await redisStock(skuA)).toBe(15);
      const txs = await prisma.inventoryTransaction.findMany({ where: { refId: receipt.code } });
      expect(txs).toHaveLength(2);
      expect(txs.find((t) => t.skuId === skuA)).toMatchObject({
        type: 'INBOUND',
        quantity: 10,
        balanceAfter: 15,
        refType: 'RECEIPT',
        createdBy: 'ADMIN_a@test',
      });
    });

    it('SKU chưa có dòng tồn: tạo mới dòng tồn tại kho', async () => {
      const category = await createCategory(prisma);
      const product = await prisma.product.create({
        data: {
          name: 'Sản phẩm mới',
          slug: `new-${randomUUID()}`,
          categoryId: category.id,
          description: '',
          thumbnailUrl: '',
          basePrice: 1,
          skus: { create: [{ skuCode: `NEW-${randomUUID()}`, name: 'v', colorName: 'x', colorHex: '#000', price: 1 }] },
        },
        include: { skus: true },
      });
      const skuId = product.skus[0]!.id;

      await service.createReceipt({ supplier_name: '', note: '', created_by: 'ADMIN', items: [{ sku_id: skuId, quantity: 7, cost_price: 0 }] });

      expect(await stockRow(skuId)).toMatchObject({ onHand: 7, reserved: 0, warehouseId });
    });

    it('nhập kho khi đang có khách giữ hàng: Redis cộng thêm, không mất phần đang giữ', async () => {
      const skuId = await skuWithStock(5);
      await service.holdStock({ ...newOrder(), items: [{ sku_id: skuId, quantity: 2 }] });

      await service.createReceipt({ supplier_name: '', note: '', created_by: 'ADMIN', items: [{ sku_id: skuId, quantity: 10, cost_price: 1 }] });

      expect(await redisStock(skuId)).toBe(13);
      await expectRedisConsistent(skuId);
    });

    it.each([
      ['số lượng 0', { quantity: 0, cost_price: 1 }],
      ['giá vốn âm', { quantity: 1, cost_price: -1 }],
    ])('dữ liệu không hợp lệ (%s): INVALID_ARGUMENT', async (_label, item) => {
      const skuId = await skuWithStock(0);

      await expectRpcError(
        service.createReceipt({ supplier_name: '', note: '', created_by: 'ADMIN', items: [{ sku_id: skuId, ...item }] }),
        status.INVALID_ARGUMENT,
      );
    });

    it('SKU trùng trong phiếu: INVALID_ARGUMENT', async () => {
      const skuId = await skuWithStock(0);

      await expectRpcError(
        service.createReceipt({
          supplier_name: '',
          note: '',
          created_by: 'ADMIN',
          items: [
            { sku_id: skuId, quantity: 1, cost_price: 1 },
            { sku_id: skuId, quantity: 2, cost_price: 1 },
          ],
        }),
        status.INVALID_ARGUMENT,
      );
    });

    it('SKU không tồn tại: NOT_FOUND, không tạo phiếu', async () => {
      await expectRpcError(
        service.createReceipt({ supplier_name: '', note: '', created_by: 'ADMIN', items: [{ sku_id: randomUUID(), quantity: 1, cost_price: 1 }] }),
        status.NOT_FOUND,
      );
      expect(await prisma.inventoryReceipt.count()).toBe(0);
    });
  });

  // ---------- AdjustStock ----------

  describe('adjustStock', () => {
    it('điều chỉnh tăng: on_hand tăng, ghi sổ ADJUSTMENT kèm lý do, Redis tăng', async () => {
      const skuId = await skuWithStock(10);
      await redis.set(`stock:${skuId}`, 10);

      const res = await service.adjustStock({ sku_id: skuId, quantity_delta: 3, reason: 'Kiểm kê thừa', created_by: 'ADMIN' });

      expect(res.adjustment_code).toMatch(/^ADJ-/);
      expect(res.stock).toMatchObject({ on_hand: 13, reserved: 0 });
      expect(await redisStock(skuId)).toBe(13);
      const [tx] = await prisma.inventoryTransaction.findMany({ where: { skuId } });
      expect(tx).toMatchObject({ type: 'ADJUSTMENT', quantity: 3, balanceAfter: 13, note: 'Kiểm kê thừa', refId: res.adjustment_code });
    });

    it('điều chỉnh giảm trong phần còn bán được: on_hand giảm, Redis giảm', async () => {
      const skuId = await skuWithStock(10);

      const res = await service.adjustStock({ sku_id: skuId, quantity_delta: -4, reason: 'Hàng hỏng', created_by: 'ADMIN' });

      expect(res.stock.on_hand).toBe(6);
      expect(await redisStock(skuId)).toBe(6);
      await expectRedisConsistent(skuId);
    });

    it('không được giảm lấn vào hàng đã giữ / đã chốt cho đơn: FAILED_PRECONDITION, không đổi gì', async () => {
      const skuId = await skuWithStock(10);
      await service.commitStock({ ...newOrder(), items: [{ sku_id: skuId, quantity: 4 }] });
      await service.holdStock({ ...newOrder(), items: [{ sku_id: skuId, quantity: 3 }] });
      // Còn bán được: 10 − 4 − 3 = 3

      await expectRpcError(
        service.adjustStock({ sku_id: skuId, quantity_delta: -4, reason: 'Hàng hỏng', created_by: 'ADMIN' }),
        status.FAILED_PRECONDITION,
        /còn bán được/,
      );

      expect(await stockRow(skuId)).toMatchObject({ onHand: 10, reserved: 4 });
      expect(await redisStock(skuId)).toBe(3);
      expect(await prisma.inventoryTransaction.count({ where: { skuId, type: 'ADJUSTMENT' } })).toBe(0);
    });

    it('điều chỉnh giảm đồng thời: tổng giảm không vượt phần còn bán được', async () => {
      const skuId = await skuWithStock(5);

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          service.adjustStock({ sku_id: skuId, quantity_delta: -1, reason: 'Kiểm kê', created_by: 'ADMIN' }),
        ),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
      expect(await stockRow(skuId)).toMatchObject({ onHand: 0 });
      expect(await redisStock(skuId)).toBe(0);
    });

    it.each([
      ['delta = 0', { quantity_delta: 0, reason: 'x' }],
      ['thiếu lý do', { quantity_delta: 1, reason: '  ' }],
    ])('dữ liệu không hợp lệ (%s): INVALID_ARGUMENT', async (_label, input) => {
      const skuId = await skuWithStock(10);

      await expectRpcError(service.adjustStock({ sku_id: skuId, created_by: 'ADMIN', ...input }), status.INVALID_ARGUMENT);
    });
  });

  // ---------- ReceiveReturn ----------

  describe('receiveReturn', () => {
    it('nhận lại toàn bộ hàng hoàn: on_hand tăng, ghi sổ RETURN, Redis tăng', async () => {
      const skuId = await skuWithStock(10);
      const order = await shippedOrder(skuId, 3); // on_hand còn 7

      const res = await service.receiveReturn({ order_id: order.order_id, performed_by: 'ADMIN', items: [], note: '' });

      expect(res.already_processed).toBe(false);
      expect(await stockRow(skuId)).toMatchObject({ onHand: 10, reserved: 0 });
      expect(await redisStock(skuId)).toBe(10);
      const returnTx = await prisma.inventoryTransaction.findFirstOrThrow({ where: { skuId, type: 'RETURN' } });
      expect(returnTx).toMatchObject({ quantity: 3, balanceAfter: 10, refType: 'ORDER', refId: order.order_code });
      await expectRedisConsistent(skuId);
    });

    it('nhận lại một phần (phần hỏng không nhập lại kho)', async () => {
      const skuId = await skuWithStock(10);
      const order = await shippedOrder(skuId, 3);

      await service.receiveReturn({
        order_id: order.order_id,
        performed_by: 'ADMIN',
        items: [{ sku_id: skuId, quantity: 2 }],
        note: '1 cái vỡ hộp',
      });

      expect(await stockRow(skuId)).toMatchObject({ onHand: 9 });
      expect(await redisStock(skuId)).toBe(9);
    });

    it('nhận hàng hoàn đồng thời / gọi lại: chỉ cộng tồn một lần', async () => {
      const skuId = await skuWithStock(10);
      const order = await shippedOrder(skuId, 3);

      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          service.receiveReturn({ order_id: order.order_id, performed_by: 'ADMIN', items: [], note: '' }),
        ),
      );

      expect(results.filter((r) => !r.already_processed)).toHaveLength(1);
      expect(await stockRow(skuId)).toMatchObject({ onHand: 10 });
      expect(await prisma.inventoryTransaction.count({ where: { skuId, type: 'RETURN' } })).toBe(1);
      await expectRedisConsistent(skuId);
    });

    it('đơn chưa xuất kho: FAILED_PRECONDITION', async () => {
      const skuId = await skuWithStock(10);
      const order = newOrder();
      await service.commitStock({ ...order, items: [{ sku_id: skuId, quantity: 1 }] });

      await expectRpcError(
        service.receiveReturn({ order_id: order.order_id, performed_by: 'ADMIN', items: [], note: '' }),
        status.FAILED_PRECONDITION,
        /chưa xuất kho/,
      );
    });

    it('nhận lại nhiều hơn số đã xuất: INVALID_ARGUMENT', async () => {
      const skuId = await skuWithStock(10);
      const order = await shippedOrder(skuId, 2);

      await expectRpcError(
        service.receiveReturn({ order_id: order.order_id, performed_by: 'ADMIN', items: [{ sku_id: skuId, quantity: 3 }], note: '' }),
        status.INVALID_ARGUMENT,
      );
    });
  });
});

describe('CatalogService – tồn kho qua InventoryService', () => {
  let prisma: PrismaProductService;
  let redis: Redis;
  let inventory: InventoryService;
  let catalog: CatalogService;
  let warehouseId: string;

  beforeAll(async () => {
    prisma = new PrismaProductService();
    await prisma.$connect();
    redis = createTestRedis();
  });

  beforeEach(async () => {
    await resetProductDb(prisma);
    await flushTestRedis(redis);
    inventory = new InventoryService(prisma);
    catalog = new CatalogService(prisma, inventory);
    warehouseId = (await createWarehouse(prisma)).id;
  });

  afterEach(() => {
    inventory.onModuleDestroy();
  });

  afterAll(async () => {
    redis.disconnect();
    await prisma.$disconnect();
  });

  it('createProduct: khởi tạo inventory_stocks và ghi sổ tồn đầu kỳ cho từng biến thể', async () => {
    const category = await createCategory(prisma);

    const product = await catalog.createProduct({
      name: 'Tai nghe mới',
      slug: 'tai-nghe-moi',
      category_id: category.id,
      description: '',
      thumbnail_url: '',
      base_price: 500000,
      featured: false,
      is_flash_sale: false,
      status: 'PUBLISHED',
      images: [],
      specs: [],
      variants: [
        { sku_code: `TN-${randomUUID()}`, name: 'Đen', color_name: 'Đen', color_hex: '#000', price: 500000, stock_quantity: 12 },
        { sku_code: `TN-${randomUUID()}`, name: 'Trắng', color_name: 'Trắng', color_hex: '#fff', price: 500000, stock_quantity: 0 },
      ],
    });

    const stocks = await prisma.inventoryStock.findMany({ where: { warehouseId }, orderBy: { onHand: 'desc' } });
    expect(stocks.map((s) => s.onHand)).toEqual([12, 0]);
    const txs = await prisma.inventoryTransaction.findMany();
    expect(txs).toEqual([
      expect.objectContaining({ type: 'INBOUND', quantity: 12, refType: 'OPENING', refId: `PRODUCT:${product.id}` }),
    ]);
  });

  it('updateSkuStock: ghi phiếu điều chỉnh phần chênh lệch, không làm mất phần đang giữ (sửa lỗi #1)', async () => {
    const { sku } = await createStockedSku(prisma, warehouseId, { onHand: 10 });
    await inventory.holdStock({ order_id: randomUUID(), order_code: 'ORD-HOLD', items: [{ sku_id: sku.id, quantity: 2 }] });
    // Redis còn 8 bán được

    const res = await catalog.updateSkuStock({ sku_id: sku.id, stock_quantity: 15, updated_by: 'ADMIN_a@test' });

    expect(res.stock_quantity).toBe(13); // trả về số còn bán được
    expect(await prisma.inventoryStock.findFirstOrThrow({ where: { skuId: sku.id } })).toMatchObject({ onHand: 15 });
    expect(Number(await redis.get(`stock:${sku.id}`))).toBe(13);
    const tx = await prisma.inventoryTransaction.findFirstOrThrow({ where: { skuId: sku.id } });
    expect(tx).toMatchObject({ type: 'ADJUSTMENT', quantity: 5, createdBy: 'ADMIN_a@test' });
  });

  it('updateSkuStock: không cho giảm tồn thấp hơn phần đã giữ / chốt', async () => {
    const { sku } = await createStockedSku(prisma, warehouseId, { onHand: 10 });
    await inventory.commitStock({ order_id: randomUUID(), order_code: 'ORD-COD', items: [{ sku_id: sku.id, quantity: 6 }] });

    await expectRpcError(catalog.updateSkuStock({ sku_id: sku.id, stock_quantity: 5 }), status.FAILED_PRECONDITION);

    expect(await prisma.inventoryStock.findFirstOrThrow({ where: { skuId: sku.id } })).toMatchObject({ onHand: 10 });
  });

  it('updateSkuStock: SKU chưa có dòng tồn tại kho mặc định → NOT_FOUND, không đổi giá', async () => {
    const category = await createCategory(prisma);
    const product = await createProduct(prisma, { categoryId: category.id, skus: [{ stock: 0 }] });
    const skuId = product.skus[0]!.id;

    await expectRpcError(catalog.updateSkuStock({ sku_id: skuId, stock_quantity: 5, price: 1 }), status.NOT_FOUND);

    expect(Number((await prisma.productSku.findUniqueOrThrow({ where: { id: skuId } })).price)).toBe(100000);
  });

  it('createProduct: không có kho mặc định → FAILED_PRECONDITION, không tạo sản phẩm', async () => {
    await prisma.warehouse.updateMany({ data: { isDefault: false } });
    const fresh = new InventoryService(prisma);
    const freshCatalog = new CatalogService(prisma, fresh);
    const category = await createCategory(prisma);

    await expectRpcError(
      freshCatalog.createProduct({
        name: 'Không có kho',
        slug: 'khong-co-kho',
        category_id: category.id,
        description: '',
        thumbnail_url: '',
        base_price: 1,
        featured: false,
        is_flash_sale: false,
        status: 'PUBLISHED',
        images: [],
        specs: [],
        variants: [{ sku_code: `NK-${randomUUID()}`, name: 'A', color_name: 'A', color_hex: '#000', price: 1, stock_quantity: 1 }],
      }),
      status.FAILED_PRECONDITION,
    );

    expect(await prisma.product.count()).toBe(0);
    fresh.onModuleDestroy();
  });

  it('updateSkuStock: chỉ đổi giá, giữ nguyên tồn → không ghi sổ', async () => {
    const { sku } = await createStockedSku(prisma, warehouseId, { onHand: 10 });

    await catalog.updateSkuStock({ sku_id: sku.id, stock_quantity: 10, price: 250000 });

    expect(await prisma.inventoryTransaction.count()).toBe(0);
    expect(Number((await prisma.productSku.findUniqueOrThrow({ where: { id: sku.id } })).price)).toBe(250000);
  });
});
