import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  OnModuleInit,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { OrderServiceClient } from '@repo/proto';
import { CartService } from '../cart/cart.service';
import {
  CreateOrderDto,
  CancelOrderDto,
  UpdateDeliveryStatusDto,
  CarrierWebhookDto,
} from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

interface RequestWithOptionalUser extends Request {
  user?: AuthenticatedUser;
}

@Controller('api/v1/orders')
export class OrderController implements OnModuleInit {
  private orderServiceClient!: OrderServiceClient;

  constructor(
    @Inject('ORDER_PACKAGE') private readonly client: ClientGrpc,
    private readonly cartService: CartService,
  ) {}

  onModuleInit() {
    this.orderServiceClient = this.client.getService<OrderServiceClient>('OrderService');
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createOrder(
    @Req() req: RequestWithUser,
    @Body() dto: CreateOrderDto,
    @Headers('x-cart-session-id') guestHeader?: string,
  ) {
    // Không tin tưởng customer_id từ client body, ép sử dụng userId từ Token xác thực
    const customerId = req.user.userId;

    const res = await firstValueFrom(
      this.orderServiceClient.createOrder({
        customer_id: customerId,
        customer_name: dto.customer_name,
        customer_phone: dto.customer_phone,
        customer_email: dto.customer_email || req.user.email,
        shipping_address_json: dto.shipping_address_json,
        payment_method: dto.payment_method || 'COD',
        voucher_code: dto.voucher_code,
        note: dto.note,
        items: dto.items,
      }),
    );

    // Khi tạo đơn thành công, tự động làm sạch giỏ hàng trên Redis
    if (res.success) {
      const cartKey = `user_${req.user.userId}`;
      try {
        await this.cartService.clearCart(cartKey);
      } catch (err: unknown) {
        console.warn('[OrderController] Failed to clear cart after order:', err);
      }
    }

    return res;
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  async getAllOrdersForAdmin(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ có quản trị viên (ADMIN) mới có quyền truy cập');
    }
    const res = await firstValueFrom(
      this.orderServiceClient.getOrdersByCustomer({
        customer_id: 'ALL',
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      }),
    );
    return res;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOrderById(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    const res = await firstValueFrom(
      this.orderServiceClient.getOrderById({
        order_id: id,
        customer_id: req.user.userId,
      }),
    );
    if (!res.order) {
      return null;
    }
    // Chống BOLA/IDOR: Chỉ chính chủ đơn hàng hoặc ADMIN mới được xem chi tiết đơn hàng
    if (res.order.customer_id && res.order.customer_id !== req.user.userId && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền truy cập thông tin đơn hàng của người khác');
    }
    return res.order;
  }

  @Get('customer/:customerId')
  @UseGuards(JwtAuthGuard)
  async getOrdersByCustomer(
    @Param('customerId') customerId: string,
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Chống BOLA/IDOR: Chỉ chính chủ hoặc ADMIN mới được xem lịch sử đơn hàng
    if (req.user.userId !== customerId && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền truy cập lịch sử đơn hàng của người khác');
    }

    const res = await firstValueFrom(
      this.orderServiceClient.getOrdersByCustomer({
        customer_id: customerId,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
      }),
    );
    return res;
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelOrder(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() dto: CancelOrderDto,
  ) {
    const customerId = req.user.userId;
    const res = await firstValueFrom(
      this.orderServiceClient.cancelOrder({
        order_id: id,
        customer_id: customerId,
        reason: dto.reason,
      }),
    );
    return res;
  }

  @Patch(':id/delivery-status')
  @UseGuards(JwtAuthGuard)
  async updateDeliveryStatus(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ có quản trị viên (ADMIN) mới có quyền thay đổi trạng thái vận chuyển');
    }
    const res = await firstValueFrom(
      this.orderServiceClient.updateDeliveryStatus({
        order_id: id,
        new_status: dto.new_status,
        location: dto.location,
        note: dto.note,
        carrier_name: dto.carrier_name,
        tracking_code: dto.tracking_code,
        changed_by: `ADMIN_${req.user.email}`,
      }),
    );
    return res;
  }

  /** Admin thử lại các thao tác kho đã thất bại của đơn (vd đã thanh toán nhưng hết hàng, kho không phản hồi) */
  @Post(':id/retry-stock-sync')
  @UseGuards(JwtAuthGuard)
  async retryStockSync(@Req() req: RequestWithUser, @Param('id') id: string) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ có quản trị viên (ADMIN) mới có quyền thử lại đồng bộ kho');
    }
    const res = await firstValueFrom(this.orderServiceClient.retryStockSync({ order_id: id }));
    return {
      success: res.success ?? false,
      message: res.message,
      stock_sync_status: res.stock_sync_status,
      stock_sync_error: res.stock_sync_error,
    };
  }

  @Post('webhook/carrier')
  async handleCarrierWebhook(@Body() dto: CarrierWebhookDto) {
    const statusMap: Record<string, string> = {
      PICKED_UP: 'SHIPPING',
      IN_TRANSIT: 'SHIPPING',
      DELIVERED: 'DELIVERED',
      FAILED: 'CANCELLED',
      RETURNED: 'CANCELLED',
    };

    const targetStatus = statusMap[dto.status] || dto.status;

    const res = await firstValueFrom(
      this.orderServiceClient.updateDeliveryStatus({
        order_id: dto.order_code,
        new_status: targetStatus,
        location: dto.location,
        note: dto.note || `Webhook đối tác vận chuyển ${dto.carrier_name || 'Vận chuyển'} cập nhật: ${dto.status}`,
        carrier_name: dto.carrier_name,
        tracking_code: dto.tracking_code,
        changed_by: `CARRIER_WEBHOOK_${dto.carrier_name || 'PARTNER'}`,
      }),
    );
    return res;
  }
}

