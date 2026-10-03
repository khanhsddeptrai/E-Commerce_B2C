import { ProductPrisma } from '@repo/database';
import { InventoryStockDto, InventoryTransactionDto, ReceiptDto } from '@repo/proto';

export const RECEIPT_INCLUDE = {
  warehouse: true,
  items: { include: { sku: { include: { product: true } } } },
} as const;

export type ReceiptWithItems = ProductPrisma.Prisma.InventoryReceiptGetPayload<{ include: typeof RECEIPT_INCLUDE }>;

export const TRANSACTION_INCLUDE = {
  warehouse: true,
  sku: { include: { product: true } },
} as const;

export type TransactionWithRelations = ProductPrisma.Prisma.InventoryTransactionGetPayload<{
  include: typeof TRANSACTION_INCLUDE;
}>;

export function mapStock(stock: ProductPrisma.InventoryStock): InventoryStockDto {
  return {
    sku_id: stock.skuId,
    warehouse_id: stock.warehouseId,
    on_hand: stock.onHand,
    reserved: stock.reserved,
  };
}

export function mapReceipt(receipt: ReceiptWithItems): ReceiptDto {
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

export function mapTransaction(tx: TransactionWithRelations): InventoryTransactionDto {
  return {
    id: tx.id,
    sku_id: tx.skuId,
    sku_code: tx.sku.skuCode,
    sku_name: tx.sku.name,
    product_name: tx.sku.product.name,
    warehouse_code: tx.warehouse.code,
    type: tx.type,
    quantity: tx.quantity,
    balance_after: tx.balanceAfter,
    ref_type: tx.refType,
    ref_id: tx.refId,
    note: tx.note ?? '',
    created_by: tx.createdBy,
    created_at: tx.createdAt.toISOString(),
  };
}

/** Chuẩn hóa tham số phân trang: page ≥ 1, 1 ≤ limit ≤ 100 (mặc định 20) */
export function normalizePagination(page?: number, limit?: number): { page: number; limit: number; skip: number } {
  const p = Math.max(1, Math.floor(Number(page) || 1));
  const l = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)));
  return { page: p, limit: l, skip: (p - 1) * l };
}
