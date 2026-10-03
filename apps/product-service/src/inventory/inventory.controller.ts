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
} from '@repo/proto';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

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
}
