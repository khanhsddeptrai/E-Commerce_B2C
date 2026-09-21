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
} from '@repo/proto';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

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
}
