import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PaymentPrisma } from '@repo/database';
import {
  CreatePaymentUrlRequest,
  CreatePaymentUrlResponse,
  VerifyPaymentReturnRequest,
  VerifyPaymentReturnResponse,
  ProcessIpnWebhookRequest,
  ProcessIpnWebhookResponse,
  GetPaymentStatusRequest,
  GetPaymentStatusResponse,
  OrderServiceClient,
} from '@repo/proto';
import { PrismaPaymentService } from '../prisma/prisma-payment.service';
import { buildVnpayUrl, formatVnpayDate, verifyVnpaySignature } from './vnpay.util';

function parseVnpayDate(dateStr?: string): Date {
  if (!dateStr || dateStr.length !== 14) return new Date();
  const y = parseInt(dateStr.slice(0, 4), 10);
  const m = parseInt(dateStr.slice(4, 6), 10) - 1;
  const d = parseInt(dateStr.slice(6, 8), 10);
  const h = parseInt(dateStr.slice(8, 10), 10);
  const min = parseInt(dateStr.slice(10, 12), 10);
  const s = parseInt(dateStr.slice(12, 14), 10);
  return new Date(Date.UTC(y, m, d, h - 7, min, s));
}

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private orderServiceClient!: OrderServiceClient;

  constructor(
    private readonly prisma: PrismaPaymentService,
    @Inject('ORDER_PACKAGE') private readonly client: ClientGrpc
  ) {}

  onModuleInit() {
    this.orderServiceClient = this.client.getService<OrderServiceClient>('OrderService');
  }

  async createPaymentUrl(data: CreatePaymentUrlRequest): Promise<CreatePaymentUrlResponse> {
    const tmnCode = process.env.VNPAY_TMN_CODE || 'CGXZLS0Z';
    const secretKey = process.env.VNPAY_HASH_SECRET || 'XNBCJFAKAZQSGTARRLGCHVZWCIOIGSHN';
    const vnpayUrl = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl =
      data.return_url ||
      process.env.VNPAY_RETURN_URL ||
      'http://localhost:3000/checkout/payment-result';

    // 1. Tạo bản ghi Payment PENDING trong database
    const payment = await this.prisma.payment.create({
      data: {
        orderId: data.order_id,
        orderCode: data.order_code,
        amount: data.amount,
        paymentMethod: PaymentPrisma.PaymentMethod.VNPAY,
        status: PaymentPrisma.PaymentStatus.PENDING,
      },
    });

    let clientIp = data.ip_address || '127.0.0.1';
    if (!clientIp || clientIp === '::1' || clientIp.includes(':')) {
      clientIp = '127.0.0.1';
    }

    const createDate = formatVnpayDate();
    const vnpParams: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: data.order_code,
      vnp_OrderInfo: `Thanh toan don hang ${data.order_code}`,
      vnp_OrderType: 'other',
      vnp_Amount: Math.round(data.amount * 100),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: clientIp,
      vnp_CreateDate: createDate,
    };

    if (data.bank_code) {
      vnpParams['vnp_BankCode'] = data.bank_code;
    }

    const paymentUrl = buildVnpayUrl(vnpParams, secretKey, vnpayUrl);

    // Lưu log khởi tạo
    await this.prisma.paymentLog.create({
      data: {
        paymentId: payment.id,
        action: 'CREATE_PAYMENT_URL',
        rawPayload: { vnpParams, paymentUrl },
      },
    });

    return {
      success: true,
      payment_url: paymentUrl,
      payment_id: payment.id,
      message: 'Tạo URL thanh toán VNPAY Sandbox thành công',
    };
  }

  async verifyPaymentReturn(data: VerifyPaymentReturnRequest): Promise<VerifyPaymentReturnResponse> {
    const secretKey = process.env.VNPAY_HASH_SECRET || 'XNBCJFAKAZQSGTARRLGCHVZWCIOIGSHN';
    const searchParams = new URLSearchParams(data.query_string);
    const queryParams: Record<string, string> = Object.fromEntries(searchParams.entries());

    const isValidSignature = verifyVnpaySignature(queryParams, secretKey);
    const orderCode = queryParams['vnp_TxnRef'] || '';
    const responseCode = queryParams['vnp_ResponseCode'] || '';
    const transactionNo = queryParams['vnp_TransactionNo'] || '';
    const bankCode = queryParams['vnp_BankCode'] || '';
    const bankTranNo = queryParams['vnp_BankTranNo'] || '';
    const cardType = queryParams['vnp_CardType'] || '';
    const rawAmount = Number(queryParams['vnp_Amount'] || 0) / 100;
    const payDateStr = queryParams['vnp_PayDate'];

    if (!isValidSignature) {
      this.logger.error(`[verifyPaymentReturn] Sai chữ ký VNPAY cho đơn hàng ${orderCode}`);
      return {
        is_valid: false,
        is_success: false,
        order_code: orderCode,
        amount: rawAmount,
        transaction_no: transactionNo,
        bank_code: bankCode,
        message: 'Chữ ký số không hợp lệ (Invalid Checksum)',
        response_code: '97',
      };
    }

    const isSuccess = responseCode === '00';

    // 1. Kiểm tra bản ghi Payment
    const payment = await this.prisma.payment.findFirst({
      where: { orderCode },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      this.logger.error(`[verifyPaymentReturn] Không tìm thấy bản ghi thanh toán cho đơn ${orderCode}`);
      return {
        is_valid: false,
        is_success: false,
        order_code: orderCode,
        amount: rawAmount,
        transaction_no: transactionNo,
        bank_code: bankCode,
        message: 'Không tìm thấy thông tin thanh toán cho đơn hàng này',
        response_code: '01',
      };
    }

    // 2. Idempotency Check: Chống Replay Attack / Callback trùng lặp
    if (payment.status === PaymentPrisma.PaymentStatus.PAID) {
      this.logger.log(`[verifyPaymentReturn] Giao dịch đơn hàng ${orderCode} đã được thanh toán thành công trước đó (Idempotent hit)`);
      return {
        is_valid: true,
        is_success: true,
        order_code: orderCode,
        amount: Number(payment.amount),
        transaction_no: payment.transactionNo || transactionNo,
        bank_code: payment.bankCode || bankCode,
        message: 'Giao dịch đơn hàng đã được ghi nhận thành công trước đó',
        response_code: '00',
      };
    }

    // 3. Amount Verification: Đối soát số tiền thực nhận với số tiền trong hóa đơn
    if (Math.abs(rawAmount - Number(payment.amount)) > 0.01) {
      this.logger.error(`[verifyPaymentReturn] Sai lệch số tiền cho đơn ${orderCode}! DB: ${payment.amount}, VNPAY: ${rawAmount}`);
      return {
        is_valid: false,
        is_success: false,
        order_code: orderCode,
        amount: rawAmount,
        transaction_no: transactionNo,
        bank_code: bankCode,
        message: 'Số tiền thanh toán thực nhận không khớp với giá trị đơn hàng',
        response_code: '04',
      };
    }

    // 4. Cập nhật bản ghi Payment
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: isSuccess ? PaymentPrisma.PaymentStatus.PAID : PaymentPrisma.PaymentStatus.FAILED,
        transactionNo,
        bankCode,
        bankTranNo,
        cardType,
        vnpResponseCode: responseCode,
        payDate: parseVnpayDate(payDateStr),
      },
    });

    await this.prisma.paymentLog.create({
      data: {
        paymentId: payment.id,
        action: isSuccess ? 'PAYMENT_RETURN_SUCCESS' : 'PAYMENT_RETURN_FAILED',
        rawPayload: queryParams,
      },
    });

    // SAGA Orchestration: Gọi sang OrderService
    if (isSuccess) {
      try {
        await firstValueFrom(
          this.orderServiceClient.processPaymentSuccess({
            order_code: orderCode,
            transaction_no: transactionNo,
            amount: rawAmount,
            payment_method: 'VNPAY',
          })
        );
        this.logger.log(`[SAGA] Xác nhận thanh toán thành công cho đơn hàng: ${orderCode}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[SAGA Error] Không thể xác nhận thanh toán đơn hàng ${orderCode}: ${msg}`);
      }

      return {
        is_valid: true,
        is_success: true,
        order_code: orderCode,
        amount: rawAmount,
        transaction_no: transactionNo,
        bank_code: bankCode,
        message: 'Thanh toán đơn hàng thành công qua VNPAY',
        response_code: responseCode,
      };
    } else {
      try {
        await firstValueFrom(
          this.orderServiceClient.processPaymentFailed({
            order_code: orderCode,
            reason: `VNPAY mã lỗi ${responseCode} (Giao dịch bị hủy hoặc không thành công)`,
          })
        );
        this.logger.warn(`[SAGA] Hủy đơn hàng và nhả tồn kho cho đơn hàng: ${orderCode}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[SAGA Error] Không thể hủy đơn hàng ${orderCode}: ${msg}`);
      }

      return {
        is_valid: true,
        is_success: false,
        order_code: orderCode,
        amount: rawAmount,
        transaction_no: transactionNo,
        bank_code: bankCode,
        message:
          responseCode === '24'
            ? 'Giao dịch đã bị khách hàng hủy bỏ'
            : 'Giao dịch thanh toán trực tuyến thất bại',
        response_code: responseCode,
      };
    }
  }

  async processIpnWebhook(data: ProcessIpnWebhookRequest): Promise<ProcessIpnWebhookResponse> {
    const secretKey = process.env.VNPAY_HASH_SECRET || 'XNBCJFAKAZQSGTARRLGCHVZWCIOIGSHN';
    const searchParams = new URLSearchParams(data.query_string);
    const queryParams: Record<string, string> = Object.fromEntries(searchParams.entries());

    const isValidSignature = verifyVnpaySignature(queryParams, secretKey);
    if (!isValidSignature) {
      return { rsp_code: '97', message: 'Invalid Checksum' };
    }

    const orderCode = queryParams['vnp_TxnRef'] || '';
    const responseCode = queryParams['vnp_ResponseCode'] || '';
    const transactionNo = queryParams['vnp_TransactionNo'] || '';
    const rawAmount = Number(queryParams['vnp_Amount'] || 0) / 100;

    const payment = await this.prisma.payment.findFirst({
      where: { orderCode },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return { rsp_code: '01', message: 'Order not found' };
    }

    if (payment.status === PaymentPrisma.PaymentStatus.PAID) {
      return { rsp_code: '02', message: 'Order already confirmed' };
    }

    const isSuccess = responseCode === '00';
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: isSuccess ? PaymentPrisma.PaymentStatus.PAID : PaymentPrisma.PaymentStatus.FAILED,
        transactionNo,
        bankCode: queryParams['vnp_BankCode'] || null,
        bankTranNo: queryParams['vnp_BankTranNo'] || null,
        cardType: queryParams['vnp_CardType'] || null,
        vnpResponseCode: responseCode,
        payDate: parseVnpayDate(queryParams['vnp_PayDate']),
      },
    });

    await this.prisma.paymentLog.create({
      data: {
        paymentId: payment.id,
        action: isSuccess ? 'IPN_WEBHOOK_SUCCESS' : 'IPN_WEBHOOK_FAILED',
        rawPayload: queryParams,
      },
    });

    if (isSuccess) {
      try {
        await firstValueFrom(
          this.orderServiceClient.processPaymentSuccess({
            order_code: orderCode,
            transaction_no: transactionNo,
            amount: rawAmount,
            payment_method: 'VNPAY',
          })
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[IPN SAGA Error] ${msg}`);
      }
    } else {
      try {
        await firstValueFrom(
          this.orderServiceClient.processPaymentFailed({
            order_code: orderCode,
            reason: `IPN thông báo giao dịch thất bại, mã lỗi: ${responseCode}`,
          })
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[IPN SAGA Error] ${msg}`);
      }
    }

    return { rsp_code: '00', message: 'Confirm Success' };
  }

  async getPaymentStatus(data: GetPaymentStatusRequest): Promise<GetPaymentStatusResponse> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderCode: data.order_code },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return {
        found: false,
        status: 'UNKNOWN',
        payment_method: 'VNPAY',
        amount: 0,
      };
    }

    return {
      found: true,
      status: payment.status,
      payment_method: payment.paymentMethod,
      amount: Number(payment.amount),
      transaction_no: payment.transactionNo || undefined,
    };
  }
}
