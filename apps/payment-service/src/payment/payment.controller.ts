import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentService } from './payment.service';
import {
  CreatePaymentUrlRequest,
  CreatePaymentUrlResponse,
  VerifyPaymentReturnRequest,
  VerifyPaymentReturnResponse,
  ProcessIpnWebhookRequest,
  ProcessIpnWebhookResponse,
  GetPaymentStatusRequest,
  GetPaymentStatusResponse,
} from '@repo/proto';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @GrpcMethod('PaymentService', 'CreatePaymentUrl')
  async createPaymentUrl(data: CreatePaymentUrlRequest): Promise<CreatePaymentUrlResponse> {
    return this.paymentService.createPaymentUrl(data);
  }

  @GrpcMethod('PaymentService', 'VerifyPaymentReturn')
  async verifyPaymentReturn(data: VerifyPaymentReturnRequest): Promise<VerifyPaymentReturnResponse> {
    return this.paymentService.verifyPaymentReturn(data);
  }

  @GrpcMethod('PaymentService', 'ProcessIpnWebhook')
  async processIpnWebhook(data: ProcessIpnWebhookRequest): Promise<ProcessIpnWebhookResponse> {
    return this.paymentService.processIpnWebhook(data);
  }

  @GrpcMethod('PaymentService', 'GetPaymentStatus')
  async getPaymentStatus(data: GetPaymentStatusRequest): Promise<GetPaymentStatusResponse> {
    return this.paymentService.getPaymentStatus(data);
  }
}
