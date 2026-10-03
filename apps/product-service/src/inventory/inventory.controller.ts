import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  AdjustStockRequest,
  AdjustStockResponse,
  CreateReceiptRequest,
  ReceiptDto,
  ReceiveReturnRequest,
  CommitStockRequest,
  GetSkusForOrderRequest,
  GetSkusForOrderResponse,
  HoldStockRequest,
  ReleaseStockRequest,
  ShipStockRequest,
  StockOperationResponse,
  GetInventoryStocksRequest,
  GetInventoryStocksResponse,
  GetInventoryTransactionsRequest,
  GetInventoryTransactionsResponse,
  GetReceiptsRequest,
  GetReceiptsResponse,
  ReconcileStockRequest,
  ReconcileStockResponse,
} from '@repo/proto';
import { InventoryService } from './inventory.service';
import { InventoryQueryService } from './inventory-query.service';

@Controller()
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly queryService: InventoryQueryService,
  ) {}

  @GrpcMethod('InventoryService', 'GetSkusForOrder')
  async getSkusForOrder(data: GetSkusForOrderRequest): Promise<GetSkusForOrderResponse> {
    return this.inventoryService.getSkusForOrder(data);
  }

  @GrpcMethod('InventoryService', 'HoldStock')
  async holdStock(data: HoldStockRequest): Promise<StockOperationResponse> {
    return this.inventoryService.holdStock(data);
  }

  @GrpcMethod('InventoryService', 'CommitStock')
  async commitStock(data: CommitStockRequest): Promise<StockOperationResponse> {
    return this.inventoryService.commitStock(data);
  }

  @GrpcMethod('InventoryService', 'ReleaseStock')
  async releaseStock(data: ReleaseStockRequest): Promise<StockOperationResponse> {
    return this.inventoryService.releaseStock(data);
  }

  @GrpcMethod('InventoryService', 'ShipStock')
  async shipStock(data: ShipStockRequest): Promise<StockOperationResponse> {
    return this.inventoryService.shipStock(data);
  }

  @GrpcMethod('InventoryService', 'ReceiveReturn')
  async receiveReturn(data: ReceiveReturnRequest): Promise<StockOperationResponse> {
    return this.inventoryService.receiveReturn(data);
  }

  @GrpcMethod('InventoryService', 'CreateReceipt')
  async createReceipt(data: CreateReceiptRequest): Promise<ReceiptDto> {
    return this.inventoryService.createReceipt(data);
  }

  @GrpcMethod('InventoryService', 'AdjustStock')
  async adjustStock(data: AdjustStockRequest): Promise<AdjustStockResponse> {
    return this.inventoryService.adjustStock(data);
  }

  @GrpcMethod('InventoryService', 'GetInventoryStocks')
  async getInventoryStocks(data: GetInventoryStocksRequest): Promise<GetInventoryStocksResponse> {
    return this.queryService.getInventoryStocks(data);
  }

  @GrpcMethod('InventoryService', 'GetInventoryTransactions')
  async getInventoryTransactions(data: GetInventoryTransactionsRequest): Promise<GetInventoryTransactionsResponse> {
    return this.queryService.getInventoryTransactions(data);
  }

  @GrpcMethod('InventoryService', 'GetReceipts')
  async getReceipts(data: GetReceiptsRequest): Promise<GetReceiptsResponse> {
    return this.queryService.getReceipts(data);
  }

  @GrpcMethod('InventoryService', 'ReconcileStock')
  async reconcileStock(data: ReconcileStockRequest): Promise<ReconcileStockResponse> {
    return this.inventoryService.reconcileStock(data);
  }
}
