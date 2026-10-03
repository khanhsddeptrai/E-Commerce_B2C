/**
 * Tiện ích seed tồn kho (WMS – docs/06-wms-implementation-plan.md).
 * Tồn kho chỉ nằm ở inventory_stocks; SKU mới seed được nhập tồn đầu kỳ vào kho mặc định
 * kèm giao dịch INBOUND trong sổ kho.
 *
 * Không ghi đè tồn của SKU đã có dòng tồn (chạy lại seed không làm sai lệch tồn đang vận hành).
 * Redis stock:{skuId} không cần ghi ở đây: Product Service tự khởi tạo key thiếu từ database
 * và đối soát toàn bộ khi khởi động.
 */

const OPENING_REF = { refType: 'OPENING', refId: 'SEED' };

let defaultWarehouseId = null;

/** @param {import('../src/generated/product-client').PrismaClient} prisma */
async function getDefaultWarehouseId(prisma) {
  if (defaultWarehouseId) return defaultWarehouseId;
  const warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true, isActive: true } });
  if (!warehouse) {
    throw new Error('Chưa có kho mặc định – chạy migrate product_db (migration tạo sẵn kho HCM-01) trước khi seed');
  }
  defaultWarehouseId = warehouse.id;
  return defaultWarehouseId;
}

/**
 * Nhập tồn đầu kỳ cho SKU nếu SKU chưa có dòng tồn ở kho mặc định.
 * @param {import('../src/generated/product-client').PrismaClient} prisma
 * @param {string} skuId
 * @param {number} quantity
 * @returns {Promise<boolean>} true nếu vừa khởi tạo tồn
 */
async function ensureOpeningStock(prisma, skuId, quantity) {
  const warehouseId = await getDefaultWarehouseId(prisma);
  const onHand = Math.max(0, Math.trunc(quantity || 0));

  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryStock.findUnique({
      where: { skuId_warehouseId: { skuId, warehouseId } },
    });
    if (existing) return false;

    await tx.inventoryStock.create({ data: { skuId, warehouseId, onHand } });
    if (onHand > 0) {
      await tx.inventoryTransaction.create({
        data: {
          skuId,
          warehouseId,
          type: 'INBOUND',
          quantity: onHand,
          balanceAfter: onHand,
          ...OPENING_REF,
          note: 'Tồn đầu kỳ từ dữ liệu mẫu (seed)',
          createdBy: 'SYSTEM_SEED',
        },
      });
    }
    return true;
  });
}

module.exports = { ensureOpeningStock };
