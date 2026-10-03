import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { ProductPrisma } from '@repo/database';
import {
  GetInventoryStocksRequest,
  GetInventoryStocksResponse,
  GetInventoryTransactionsRequest,
  GetInventoryTransactionsResponse,
  GetReceiptsRequest,
  GetReceiptsResponse,
  InventoryStockItemDto,
} from '@repo/proto';
import { PrismaProductService } from '../prisma/prisma-product.service';
import {
  mapReceipt,
  mapTransaction,
  normalizePagination,
  RECEIPT_INCLUDE,
  TRANSACTION_INCLUDE,
} from './inventory.mappers';

const { Prisma } = ProductPrisma;
const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const TRANSACTION_TYPES: readonly ProductPrisma.InventoryTransactionType[] = ['INBOUND', 'OUTBOUND', 'RETURN', 'ADJUSTMENT'];

interface StockRow {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  product_id: string;
  product_name: string;
  warehouse_id: string;
  warehouse_code: string;
  on_hand: number;
  reserved: number;
  held: number;
  available: number;
}

function parseDate(value: string | undefined, field: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RpcException({ code: status.INVALID_ARGUMENT, message: `Thời gian ${field} không hợp lệ` });
  }
  return date;
}

/** Truy vấn tồn kho, sổ xuất nhập tồn và phiếu nhập cho trang quản trị (đều có phân trang) */
@Injectable()
export class InventoryQueryService {
  constructor(private readonly prisma: PrismaProductService) {}

  /** Danh sách tồn theo SKU × kho, sắp xếp số còn bán được tăng dần (hàng sắp hết lên đầu) */
  async getInventoryStocks(data: GetInventoryStocksRequest): Promise<GetInventoryStocksResponse> {
    const { page, limit, skip } = normalizePagination(data.page, data.limit);
    const threshold = data.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

    const conditions: ProductPrisma.Prisma.Sql[] = [];
    const search = data.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(Prisma.sql`(p.name ILIKE ${pattern} OR k.name ILIKE ${pattern} OR k.sku_code ILIKE ${pattern})`);
    }
    if (data.warehouse_id) {
      conditions.push(Prisma.sql`s.warehouse_id = ${data.warehouse_id}::uuid`);
    }
    if (data.low_stock_only) {
      conditions.push(Prisma.sql`(s.on_hand - s.reserved - COALESCE(h.held, 0)) <= ${threshold}`);
    }
    const where = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const from = Prisma.sql`
      FROM inventory_stocks s
      JOIN product_skus k ON k.id = s.sku_id
      JOIN products p ON p.id = k.product_id
      JOIN warehouses w ON w.id = s.warehouse_id
      LEFT JOIN (
        SELECT sku_id, warehouse_id, SUM(quantity)::int AS held
        FROM inventory_reservations
        WHERE status = 'HOLD'
        GROUP BY sku_id, warehouse_id
      ) h ON h.sku_id = s.sku_id AND h.warehouse_id = s.warehouse_id
      ${where}
    `;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<StockRow[]>`
        SELECT s.sku_id::text AS sku_id, k.sku_code, k.name AS sku_name,
               p.id::text AS product_id, p.name AS product_name,
               s.warehouse_id::text AS warehouse_id, w.code AS warehouse_code,
               s.on_hand, s.reserved, COALESCE(h.held, 0)::int AS held,
               (s.on_hand - s.reserved - COALESCE(h.held, 0))::int AS available
        ${from}
        ORDER BY available ASC, p.name ASC, k.sku_code ASC
        LIMIT ${limit} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`SELECT COUNT(*)::int AS total ${from}`,
    ]);

    return {
      items: rows.map((r): InventoryStockItemDto => ({ ...r, available: Math.max(0, r.available) })),
      total: countRows[0]?.total ?? 0,
      page,
      limit,
    };
  }

  /** Sổ xuất – nhập – tồn, mới nhất lên đầu */
  async getInventoryTransactions(data: GetInventoryTransactionsRequest): Promise<GetInventoryTransactionsResponse> {
    const { page, limit, skip } = normalizePagination(data.page, data.limit);
    const where: ProductPrisma.Prisma.InventoryTransactionWhereInput = {};

    if (data.sku_id) where.skuId = data.sku_id;
    if (data.ref_id) where.refId = data.ref_id;
    if (data.type) {
      if (!TRANSACTION_TYPES.includes(data.type as ProductPrisma.InventoryTransactionType)) {
        throw new RpcException({ code: status.INVALID_ARGUMENT, message: `Loại giao dịch kho không hợp lệ: ${data.type}` });
      }
      where.type = data.type as ProductPrisma.InventoryTransactionType;
    }
    const fromDate = parseDate(data.from, 'bắt đầu');
    const toDate = parseDate(data.to, 'kết thúc');
    if (fromDate || toDate) where.createdAt = { gte: fromDate, lte: toDate };

    const [total, items] = await Promise.all([
      this.prisma.inventoryTransaction.count({ where }),
      this.prisma.inventoryTransaction.findMany({
        where,
        include: TRANSACTION_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return { items: items.map(mapTransaction), total, page, limit };
  }

  /** Danh sách phiếu nhập kho, mới nhất lên đầu */
  async getReceipts(data: GetReceiptsRequest): Promise<GetReceiptsResponse> {
    const { page, limit, skip } = normalizePagination(data.page, data.limit);
    const search = data.search?.trim();
    const where: ProductPrisma.Prisma.InventoryReceiptWhereInput = search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { supplierName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, items] = await Promise.all([
      this.prisma.inventoryReceipt.count({ where }),
      this.prisma.inventoryReceipt.findMany({
        where,
        include: RECEIPT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { items: items.map(mapReceipt), total, page, limit };
  }
}
