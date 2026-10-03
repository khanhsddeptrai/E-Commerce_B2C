import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { OrderService } from './order.service';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  GetOrderByIdRequest,
  GetOrderByIdResponse,
  GetOrdersByCustomerRequest,
  GetOrdersByCustomerResponse,
  CancelOrderRequest,
  CancelOrderResponse,
  ProcessPaymentSuccessRequest,
  ProcessPaymentSuccessResponse,
  ProcessPaymentFailedRequest,
  ProcessPaymentFailedResponse,
  UpdateDeliveryStatusRequest,
  UpdateDeliveryStatusResponse,
  RetryStockSyncRequest,
  RetryStockSyncResponse,
} from '@repo/proto';
import { StockSyncService } from '../stock-sync/stock-sync.service';

@Controller()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly stockSync: StockSyncService,
  ) {}

  @GrpcMethod('OrderService', 'CreateOrder')
  async createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
    return this.orderService.createOrder(data);
  }

  @GrpcMethod('OrderService', 'GetOrderById')
  async getOrderById(data: GetOrderByIdRequest): Promise<GetOrderByIdResponse> {
    return this.orderService.getOrderById(data);
  }

  @GrpcMethod('OrderService', 'GetOrdersByCustomer')
  async getOrdersByCustomer(data: GetOrdersByCustomerRequest): Promise<GetOrdersByCustomerResponse> {
    return this.orderService.getOrdersByCustomer(data);
  }

  @GrpcMethod('OrderService', 'CancelOrder')
  async cancelOrder(data: CancelOrderRequest): Promise<CancelOrderResponse> {
    return this.orderService.cancelOrder(data);
  }

  @GrpcMethod('OrderService', 'ProcessPaymentSuccess')
  async processPaymentSuccess(data: ProcessPaymentSuccessRequest): Promise<ProcessPaymentSuccessResponse> {
    return this.orderService.processPaymentSuccess(data);
  }

  @GrpcMethod('OrderService', 'ProcessPaymentFailed')
  async processPaymentFailed(data: ProcessPaymentFailedRequest): Promise<ProcessPaymentFailedResponse> {
    return this.orderService.processPaymentFailed(data);
  }

  @GrpcMethod('OrderService', 'UpdateDeliveryStatus')
  async updateDeliveryStatus(data: UpdateDeliveryStatusRequest): Promise<UpdateDeliveryStatusResponse> {
    return this.orderService.updateDeliveryStatus(data);
  }

  @GrpcMethod('OrderService', 'RetryStockSync')
  async retryStockSync(data: RetryStockSyncRequest): Promise<RetryStockSyncResponse> {
    const state = await this.stockSync.retryOrder(data.order_id);
    return {
      success: state.status !== 'FAILED',
      message:
        state.status === 'OK'
          ? 'Đồng bộ kho thành công'
          : state.status === 'PENDING'
            ? 'Đang chờ đồng bộ kho, hệ thống sẽ tự thử lại'
            : 'Đồng bộ kho vẫn thất bại',
      stock_sync_status: state.status,
      stock_sync_error: state.error,
    };
  }
}

