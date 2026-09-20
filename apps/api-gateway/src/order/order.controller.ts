import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  OnModuleInit,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { OrderServiceClient } from '@repo/proto';
import { CartService } from '../cart/cart.service';
import { CreateOrderDto, CancelOrderDto } from './dto/create-order.dto';

interface RequestWithOptionalUser extends Request {
  user?: {
    userId: string;
    email: string;
  };
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
  async createOrder(
    @Req() req: RequestWithOptionalUser,
    @Body() dto: CreateOrderDto,
    @Headers('x-cart-session-id') guestHeader?: string,
  ) {
    const customerId = req.user?.userId || '00000000-0000-0000-0000-000000000000';

    const res = await firstValueFrom(
      this.orderServiceClient.createOrder({
        customer_id: customerId,
        customer_name: dto.customer_name,
        customer_phone: dto.customer_phone,
        customer_email: dto.customer_email,
        shipping_address_json: dto.shipping_address_json,
        payment_method: dto.payment_method || 'COD',
        voucher_code: dto.voucher_code,
        note: dto.note,
        items: dto.items,
      }),
    );

    // Khi tạo đơn thành công, tự động làm sạch giỏ hàng trên Redis
    if (res.success) {
      const cartKey = req.user?.userId ? `user_${req.user.userId}` : (guestHeader ? `guest_${guestHeader.trim()}` : 'guest_default_session');
      try {
        await this.cartService.clearCart(cartKey);
      } catch (err: unknown) {
        console.warn('[OrderController] Failed to clear cart after order:', err);
      }
    }

    return res;
  }

  @Get(':id')
  async getOrderById(
    @Param('id') id: string,
    @Req() req: RequestWithOptionalUser,
  ) {
    const res = await firstValueFrom(
      this.orderServiceClient.getOrderById({
        order_id: id,
        customer_id: req.user?.userId,
      }),
    );
    return res.order;
  }

  @Get('customer/:customerId')
  async getOrdersByCustomer(
    @Param('customerId') customerId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
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
  async cancelOrder(
    @Param('id') id: string,
    @Req() req: RequestWithOptionalUser,
    @Body() dto: CancelOrderDto,
  ) {
    const customerId = req.user?.userId || '00000000-0000-0000-0000-000000000000';
    const res = await firstValueFrom(
      this.orderServiceClient.cancelOrder({
        order_id: id,
        customer_id: customerId,
        reason: dto.reason,
      }),
    );
    return res;
  }
}
