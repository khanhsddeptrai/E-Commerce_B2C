import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  OnModuleInit,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import {
  InventoryServiceClient,
  InventoryStockItemDto,
  InventoryTransactionDto,
  ReceiptDto,
  ReceiptItemDto,
} from '@repo/proto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AdjustStockDto,
  CreateReceiptDto,
  GetInventoryStocksQueryDto,
  GetInventoryTransactionsQueryDto,
  GetReceiptsQueryDto,
} from './dto/inventory.dto';

interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

// Client gRPC chỉ bật keepCase: mảng rỗng / số 0 / false / chuỗi rỗng bị bỏ khỏi response
// → luôn điền giá trị mặc định trước khi trả về cho client
function mapStockItem(s: Partial<InventoryStockItemDto>): InventoryStockItemDto {
  return {
    sku_id: s.sku_id ?? '',
    sku_code: s.sku_code ?? '',
    sku_name: s.sku_name ?? '',
    product_id: s.product_id ?? '',
    product_name: s.product_name ?? '',
    warehouse_id: s.warehouse_id ?? '',
    warehouse_code: s.warehouse_code ?? '',
    on_hand: s.on_hand ?? 0,
    reserved: s.reserved ?? 0,
    held: s.held ?? 0,
    available: s.available ?? 0,
  };
}

function mapTransaction(t: Partial<InventoryTransactionDto>): InventoryTransactionDto {
  return {
    id: t.id ?? '',
    sku_id: t.sku_id ?? '',
    sku_code: t.sku_code ?? '',
    sku_name: t.sku_name ?? '',
    product_name: t.product_name ?? '',
    warehouse_code: t.warehouse_code ?? '',
    type: t.type ?? 'ADJUSTMENT',
    quantity: t.quantity ?? 0,
    balance_after: t.balance_after ?? 0,
    ref_type: t.ref_type ?? '',
    ref_id: t.ref_id ?? '',
    note: t.note ?? '',
    created_by: t.created_by ?? '',
    created_at: t.created_at ?? '',
  };
}

function mapReceiptItem(i: Partial<ReceiptItemDto>): ReceiptItemDto {
  return {
    sku_id: i.sku_id ?? '',
    sku_code: i.sku_code ?? '',
    sku_name: i.sku_name ?? '',
    product_name: i.product_name ?? '',
    quantity: i.quantity ?? 0,
    cost_price: i.cost_price ?? 0,
  };
}

function mapReceipt(r: Partial<ReceiptDto>): ReceiptDto {
  return {
    id: r.id ?? '',
    code: r.code ?? '',
    warehouse_id: r.warehouse_id ?? '',
    warehouse_code: r.warehouse_code ?? '',
    supplier_name: r.supplier_name ?? '',
    note: r.note ?? '',
    created_by: r.created_by ?? '',
    created_at: r.created_at ?? '',
    items: (r.items ?? []).map(mapReceiptItem),
    total_quantity: r.total_quantity ?? 0,
    total_cost: r.total_cost ?? 0,
  };
}

@Controller('api/v1/admin/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController implements OnModuleInit {
  private inventoryClient!: InventoryServiceClient;

  constructor(@Inject('INVENTORY_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.inventoryClient = this.client.getService<InventoryServiceClient>('InventoryService');
  }

  private assertAdmin(req: RequestWithUser) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ có quản trị viên (ADMIN) mới có quyền truy cập quản lý kho');
    }
  }

  @Get('stocks')
  async getStocks(@Req() req: RequestWithUser, @Query() query: GetInventoryStocksQueryDto) {
    this.assertAdmin(req);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const res = await firstValueFrom(
      this.inventoryClient.getInventoryStocks({
        page,
        limit,
        search: query.search || undefined,
        low_stock_only: query.low_stock_only,
        low_stock_threshold: query.low_stock_threshold,
      }),
    );
    return {
      items: (res.items ?? []).map(mapStockItem),
      total: res.total ?? 0,
      page: res.page ?? page,
      limit: res.limit ?? limit,
    };
  }

  @Get('transactions')
  async getTransactions(@Req() req: RequestWithUser, @Query() query: GetInventoryTransactionsQueryDto) {
    this.assertAdmin(req);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const res = await firstValueFrom(
      this.inventoryClient.getInventoryTransactions({
        page,
        limit,
        sku_id: query.sku_id || undefined,
        type: query.type || undefined,
        ref_id: query.ref_id || undefined,
        from: query.from || undefined,
        to: query.to || undefined,
      }),
    );
    return {
      items: (res.items ?? []).map(mapTransaction),
      total: res.total ?? 0,
      page: res.page ?? page,
      limit: res.limit ?? limit,
    };
  }

  @Get('receipts')
  async getReceipts(@Req() req: RequestWithUser, @Query() query: GetReceiptsQueryDto) {
    this.assertAdmin(req);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const res = await firstValueFrom(
      this.inventoryClient.getReceipts({ page, limit, search: query.search || undefined }),
    );
    return {
      items: (res.items ?? []).map(mapReceipt),
      total: res.total ?? 0,
      page: res.page ?? page,
      limit: res.limit ?? limit,
    };
  }

  @Post('receipts')
  async createReceipt(@Req() req: RequestWithUser, @Body() dto: CreateReceiptDto) {
    this.assertAdmin(req);
    const res = await firstValueFrom(
      this.inventoryClient.createReceipt({
        supplier_name: dto.supplier_name.trim(),
        note: dto.note?.trim() ?? '',
        created_by: `ADMIN_${req.user.email}`,
        items: dto.items.map((i) => ({ sku_id: i.sku_id, quantity: i.quantity, cost_price: i.cost_price })),
      }),
    );
    return mapReceipt(res);
  }

  @Post('adjustments')
  async adjustStock(@Req() req: RequestWithUser, @Body() dto: AdjustStockDto) {
    this.assertAdmin(req);
    const res = await firstValueFrom(
      this.inventoryClient.adjustStock({
        sku_id: dto.sku_id,
        quantity_delta: dto.quantity_delta,
        reason: dto.reason.trim(),
        created_by: `ADMIN_${req.user.email}`,
      }),
    );
    return {
      adjustment_code: res.adjustment_code ?? '',
      stock: {
        sku_id: res.stock?.sku_id ?? dto.sku_id,
        warehouse_id: res.stock?.warehouse_id ?? '',
        on_hand: res.stock?.on_hand ?? 0,
        reserved: res.stock?.reserved ?? 0,
      },
    };
  }

  /** Dựng lại Redis từ database – chỉ nên chạy khi ít giao dịch */
  @Post('reconcile')
  async reconcile(@Req() req: RequestWithUser) {
    this.assertAdmin(req);
    const res = await firstValueFrom(this.inventoryClient.reconcileStock({ sku_ids: [] }));
    return {
      checked: res.checked ?? 0,
      drifts: (res.drifts ?? []).map((d) => ({
        sku_id: d.sku_id ?? '',
        redis_before: d.redis_before ?? null,
        expected: d.expected ?? 0,
      })),
    };
  }
}
