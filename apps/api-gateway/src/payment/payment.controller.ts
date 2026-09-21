import {
  Body,
  Controller,
  Get,
  Inject,
  OnModuleInit,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { PaymentServiceClient } from '@repo/proto';
import { CreatePaymentUrlDto } from './dto/payment.dto';

@Controller('api/v1/payments')
export class PaymentController implements OnModuleInit {
  private paymentServiceClient!: PaymentServiceClient;

  constructor(@Inject('PAYMENT_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.paymentServiceClient = this.client.getService<PaymentServiceClient>('PaymentService');
  }

  @Post('create-url')
  async createPaymentUrl(@Req() req: Request, @Body() dto: CreatePaymentUrlDto) {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    let clientIp = Array.isArray(rawIp)
      ? rawIp[0]
      : typeof rawIp === 'string'
        ? rawIp.split(',')[0].trim()
        : '127.0.0.1';

    if (!clientIp || clientIp === '::1' || clientIp.includes(':')) {
      clientIp = '127.0.0.1';
    }

    const response = await firstValueFrom(
      this.paymentServiceClient.createPaymentUrl({
        order_id: dto.order_id,
        order_code: dto.order_code,
        amount: dto.amount,
        payment_method: dto.payment_method || 'VNPAY',
        bank_code: dto.bank_code,
        ip_address: clientIp,
        return_url: dto.return_url,
      })
    );

    return response;
  }

  @Get('vnpay-return')
  async verifyPaymentReturn(@Req() req: Request) {
    const rawUrl = req.originalUrl || req.url || '';
    const queryString = rawUrl.includes('?') ? rawUrl.split('?')[1] : '';

    const response = await firstValueFrom(
      this.paymentServiceClient.verifyPaymentReturn({
        query_string: queryString,
      })
    );

    return response;
  }

  @Get('vnpay-ipn')
  async processIpnWebhook(@Req() req: Request) {
    const rawUrl = req.originalUrl || req.url || '';
    const queryString = rawUrl.includes('?') ? rawUrl.split('?')[1] : '';

    const response = await firstValueFrom(
      this.paymentServiceClient.processIpnWebhook({
        query_string: queryString,
      })
    );

    return {
      RspCode: response.rsp_code,
      Message: response.message,
    };
  }

  @Get('status/:orderCode')
  async getPaymentStatus(@Param('orderCode') orderCode: string) {
    const response = await firstValueFrom(
      this.paymentServiceClient.getPaymentStatus({
        order_code: orderCode,
      })
    );

    return response;
  }
}
