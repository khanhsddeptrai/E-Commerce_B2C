import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartQuantityDto } from './dto/cart.dto';

interface RequestWithOptionalUser extends Request {
  user?: {
    userId: string;
  };
}

@Controller('api/v1/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private resolveCartKey(
    req: RequestWithOptionalUser,
    guestHeader?: string,
  ): string {
    if (req.user?.userId) {
      return `user_${req.user.userId}`;
    }
    if (guestHeader && guestHeader.trim()) {
      return `guest_${guestHeader.trim()}`;
    }
    return 'guest_default_session';
  }

  @Get()
  async getCart(
    @Req() req: RequestWithOptionalUser,
    @Headers('x-cart-session-id') guestHeader?: string,
  ) {
    const cartKey = this.resolveCartKey(req, guestHeader);
    return this.cartService.getCart(cartKey);
  }

  @Post('items')
  async addItem(
    @Req() req: RequestWithOptionalUser,
    @Body() dto: AddCartItemDto,
    @Headers('x-cart-session-id') guestHeader?: string,
  ) {
    const cartKey = this.resolveCartKey(req, guestHeader);
    return this.cartService.addItem(cartKey, dto);
  }

  @Patch('items/:skuId')
  async updateQuantity(
    @Req() req: RequestWithOptionalUser,
    @Param('skuId') skuId: string,
    @Body() dto: UpdateCartQuantityDto,
    @Headers('x-cart-session-id') guestHeader?: string,
  ) {
    const cartKey = this.resolveCartKey(req, guestHeader);
    return this.cartService.updateQuantity(cartKey, skuId, dto.quantity);
  }

  @Delete('items/:skuId')
  async removeItem(
    @Req() req: RequestWithOptionalUser,
    @Param('skuId') skuId: string,
    @Headers('x-cart-session-id') guestHeader?: string,
  ) {
    const cartKey = this.resolveCartKey(req, guestHeader);
    return this.cartService.removeItem(cartKey, skuId);
  }

  @Delete()
  async clearCart(
    @Req() req: RequestWithOptionalUser,
    @Headers('x-cart-session-id') guestHeader?: string,
  ) {
    const cartKey = this.resolveCartKey(req, guestHeader);
    return this.cartService.clearCart(cartKey);
  }
}
