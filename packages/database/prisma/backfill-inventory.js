/**
 * Chuyển dữ liệu tồn kho cũ sang mô hình WMS (docs/06-wms-implementation-plan.md – Bước 1).
 *
 * Mô hình cũ:  product_skus.stock_quantity bị trừ ngay khi CHỐT ĐƠN (COD lúc đặt, VNPAY lúc thanh toán)
 *              + order_db.inventory_reservations + Redis stock:{skuId}
 * Mô hình mới: inventory_stocks.on_hand (tồn vật lý, trừ lúc XUẤT KHO) + reserved (đã chốt, chưa xuất)
 *              + inventory_reservations (product_db) + Redis stock:{skuId} = on_hand − reserved − HOLD chưa nhả
 *
 * Quy tắc chuyển đổi cho mỗi SKU chưa có dòng tồn ở kho mặc định:
 *   - Đơn CONFIRMED / PROCESSING (đã chốt, chưa xuất kho):
 *       reserved += số lượng; nếu tồn cũ ĐÃ bị trừ (COD, hoặc đã thanh toán) thì on_hand += số lượng
 *       (đơn VNPAY được admin xác nhận thủ công khi chưa thanh toán thì tồn cũ chưa bị trừ)
 *   - Đơn PENDING có giữ hàng HOLD còn hạn: chép sang reservation HOLD (không đổi on_hand / reserved)
 *   - Đơn SHIPPING / DELIVERED / CANCELLED / RETURNED: bỏ qua (hàng đã rời kho hoặc đã được hoàn tồn)
 *
 * Idempotent: SKU đã có dòng tồn được bỏ qua, nên chạy lại an toàn (vd sau khi seed thêm sản phẩm).
 * Chỉ chạy khi các service đang DỪNG (lúc chuyển đổi hệ thống), vì script dựng lại Redis.
 *
 * Cách chạy: pnpm --filter @repo/database db:inventory:backfill
 */
const path = require('path');
const fs = require('fs');

const DEFAULT_WAREHOUSE = { code: 'HCM-01', name: 'Kho tổng Hồ Chí Minh' };
const OPENING_REF = { refType: 'OPENING', refId: 'WMS-MIGRATION' };
const COMMITTED_ORDER_STATUSES = ['CONFIRMED', 'PROCESSING'];

function addTo(map, key, value) {
  map.set(key, (map.get(key) || 0) + value);
}

/** Tồn cũ đã bị trừ khi chốt đơn chưa: COD trừ lúc đặt, VNPAY/khác trừ khi thanh toán thành công */
function isLegacyStockDeducted(order) {
  return order.paymentMethod === 'COD' || order.paymentStatus === 'PAID';
}

/**
 * @param {object} deps
 * @param {import('../src/generated/product-client').PrismaClient} deps.productPrisma
 * @param {import('../src/generated/order-client').PrismaClient} deps.orderPrisma
 * @param {import('ioredis').default} deps.redis
 * @param {Date} [deps.now]
 * @param {(msg: string) => void} [deps.log]
 */
async function backfillInventory({ productPrisma, orderPrisma, redis, now = new Date(), log = () => {} }) {
  // 1. Kho mặc định
  const warehouse = await productPrisma.warehouse.upsert({
    where: { code: DEFAULT_WAREHOUSE.code },
    update: {},
    create: { ...DEFAULT_WAREHOUSE, isDefault: true },
  });

  // 2. Đọc các đơn còn ảnh hưởng tới tồn kho từ order_db
  const committedOrders = await orderPrisma.order.findMany({
    where: { orderStatus: { in: COMMITTED_ORDER_STATUSES } },
    include: { items: true },
  });
  const activeHolds = await orderPrisma.inventoryReservation.findMany({
    where: { status: 'HOLD', expiresAt: { gt: now }, order: { orderStatus: 'PENDING' } },
    include: { order: { select: { id: true, orderCode: true } } },
  });

  const reservedBySku = new Map();
  const addBackBySku = new Map();
  /** key `${orderId}:${skuId}` → { orderId, orderCode, skuId, quantity, status, expiresAt } */
  const reservations = new Map();

  for (const order of committedOrders) {
    const deducted = isLegacyStockDeducted(order);
    for (const item of order.items) {
      addTo(reservedBySku, item.skuId, item.quantity);
      if (deducted) addTo(addBackBySku, item.skuId, item.quantity);
      const key = `${order.id}:${item.skuId}`;
      const existing = reservations.get(key);
      reservations.set(key, {
        orderId: order.id,
        orderCode: order.orderCode,
        skuId: item.skuId,
        quantity: (existing ? existing.quantity : 0) + item.quantity,
        status: 'COMMITTED',
        expiresAt: null,
      });
    }
  }

  for (const hold of activeHolds) {
    const key = `${hold.order.id}:${hold.skuId}`;
    const existing = reservations.get(key);
    reservations.set(key, {
      orderId: hold.order.id,
      orderCode: hold.order.orderCode,
      skuId: hold.skuId,
      quantity: (existing ? existing.quantity : 0) + hold.quantity,
      status: 'HOLD',
      expiresAt: hold.expiresAt,
    });
  }

  // 3. Khởi tạo tồn cho các SKU chưa có dòng tồn ở kho mặc định
  const skus = await productPrisma.productSku.findMany({ select: { id: true, skuCode: true, stockQuantity: true } });
  const initializedSkuIds = new Set(
    (
      await productPrisma.inventoryStock.findMany({
        where: { warehouseId: warehouse.id },
        select: { skuId: true },
      })
    ).map((s) => s.skuId),
  );
  const skusToInit = skus.filter((s) => !initializedSkuIds.has(s.id));
  const skuIdsToInit = new Set(skusToInit.map((s) => s.id));
  const warnings = [];

  await productPrisma.$transaction(async (tx) => {
    for (const sku of skusToInit) {
      const onHand = sku.stockQuantity + (addBackBySku.get(sku.id) || 0);
      const reserved = reservedBySku.get(sku.id) || 0;
      if (onHand < 0) {
        throw new Error(`SKU ${sku.skuCode}: tồn tính ra bị âm (${onHand}) – kiểm tra lại dữ liệu trước khi chuyển đổi`);
      }
      if (reserved > onHand) {
        warnings.push(`SKU ${sku.skuCode}: đã chốt ${reserved} nhưng tồn vật lý chỉ ${onHand}`);
      }

      await tx.inventoryStock.create({
        data: { skuId: sku.id, warehouseId: warehouse.id, onHand, reserved },
      });
      if (onHand > 0) {
        await tx.inventoryTransaction.create({
          data: {
            skuId: sku.id,
            warehouseId: warehouse.id,
            type: 'INBOUND',
            quantity: onHand,
            balanceAfter: onHand,
            ...OPENING_REF,
            note: 'Tồn đầu kỳ khi chuyển sang quản lý kho WMS',
            createdBy: 'SYSTEM_MIGRATION',
          },
        });
      }
    }

    for (const r of reservations.values()) {
      if (!skuIdsToInit.has(r.skuId)) continue;
      await tx.inventoryReservation.upsert({
        where: { orderId_skuId_warehouseId: { orderId: r.orderId, skuId: r.skuId, warehouseId: warehouse.id } },
        update: {},
        create: { ...r, warehouseId: warehouse.id },
      });
    }
  });

  // 4. Dựng lại Redis: còn bán được = Σ(on_hand − reserved) − Σ HOLD chưa nhả, trên mọi kho
  // (cùng công thức với InventoryService.computeAvailableFromDb: HOLD quá hạn vẫn tính cho tới khi worker nhả,
  //  nếu không lúc worker nhả và cộng trả Redis sẽ bị cộng hai lần)
  const stocks = await productPrisma.inventoryStock.findMany({ select: { skuId: true, onHand: true, reserved: true } });
  const holds = await productPrisma.inventoryReservation.findMany({
    where: { status: 'HOLD' },
    select: { skuId: true, quantity: true },
  });
  const availableBySku = new Map();
  for (const s of stocks) addTo(availableBySku, s.skuId, s.onHand - s.reserved);
  for (const h of holds) addTo(availableBySku, h.skuId, -h.quantity);

  const pipeline = redis.pipeline();
  for (const [skuId, available] of availableBySku) {
    pipeline.set(`stock:${skuId}`, Math.max(0, available));
  }
  await pipeline.exec();

  const createdReservations = [...reservations.values()].filter((r) => skuIdsToInit.has(r.skuId));
  const summary = {
    warehouseCode: warehouse.code,
    initializedSkus: skusToInit.length,
    skippedSkus: skus.length - skusToInit.length,
    committedReservations: createdReservations.filter((r) => r.status === 'COMMITTED').length,
    holdReservations: createdReservations.filter((r) => r.status === 'HOLD').length,
    redisKeys: availableBySku.size,
    warnings,
  };
  log(`[backfill-inventory] ${JSON.stringify(summary, null, 2)}`);
  return summary;
}

module.exports = { backfillInventory, DEFAULT_WAREHOUSE };

if (require.main === module) {
  for (const p of [path.resolve(__dirname, '../.env'), path.resolve(__dirname, '../../../.env')]) {
    if (fs.existsSync(p)) require('dotenv').config({ path: p });
  }
  const { PrismaClient: ProductPrismaClient } = require('../src/generated/product-client');
  const { PrismaClient: OrderPrismaClient } = require('../src/generated/order-client');
  const Redis = require('ioredis');

  const productPrisma = new ProductPrismaClient({ datasources: { db: { url: process.env.PRODUCT_DATABASE_URL } } });
  const orderPrisma = new OrderPrismaClient({ datasources: { db: { url: process.env.ORDER_DATABASE_URL } } });
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  backfillInventory({ productPrisma, orderPrisma, redis, log: console.log })
    .catch((err) => {
      console.error('[backfill-inventory] Thất bại:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await Promise.all([productPrisma.$disconnect(), orderPrisma.$disconnect()]);
      redis.disconnect();
    });
}
