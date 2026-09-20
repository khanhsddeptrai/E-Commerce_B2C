import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { AddCartItemDto } from './dto/cart.dto';

export interface CartStoredItem {
  sku_id: string;
  product_id?: string;
  product_name?: string;
  product_slug?: string;
  variant_name?: string;
  color_name?: string;
  price: number;
  original_price?: number;
  image?: string;
  quantity: number;
  max_stock: number;
  added_at: string;
}

export interface CartResponse {
  cart_key: string;
  items: CartStoredItem[];
  item_count: number;
  subtotal_amount: number;
}

const CART_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 ngày

@Injectable()
export class CartService {
  constructor(private readonly redisService: RedisService) {}

  private getCartKey(cartKey: string): string {
    return `cart:${cartKey.trim()}`;
  }

  async getCart(cartKey: string): Promise<CartResponse> {
    const redis = this.redisService.getClient();
    const key = this.getCartKey(cartKey);
    const rawData = await redis.hgetall(key);

    const items: CartStoredItem[] = [];
    let subtotal = 0;
    let count = 0;

    for (const [skuId, rawJson] of Object.entries(rawData)) {
      try {
        const item = JSON.parse(rawJson) as CartStoredItem;
        items.push(item);
        subtotal += Number(item.price || 0) * Number(item.quantity || 1);
        count += Number(item.quantity || 1);
      } catch (err: unknown) {
        console.warn(`[CartService] Failed to parse item ${skuId}:`, err);
      }
    }

    return {
      cart_key: cartKey,
      items,
      item_count: count,
      subtotal_amount: subtotal,
    };
  }

  async addItem(cartKey: string, dto: AddCartItemDto): Promise<CartResponse> {
    const redis = this.redisService.getClient();
    const key = this.getCartKey(cartKey);

    const existingRaw = await redis.hget(key, dto.sku_id);
    let item: CartStoredItem;

    if (existingRaw) {
      try {
        item = JSON.parse(existingRaw) as CartStoredItem;
        item.quantity += Number(dto.quantity || 1);
      } catch {
        item = {
          sku_id: dto.sku_id,
          product_id: dto.product_id,
          product_name: dto.product_name,
          product_slug: dto.product_slug,
          variant_name: dto.variant_name,
          color_name: dto.color_name,
          price: Number(dto.price || 0),
          original_price: dto.original_price ? Number(dto.original_price) : undefined,
          image: dto.image,
          quantity: Number(dto.quantity || 1),
          max_stock: Number(dto.max_stock || 99),
          added_at: new Date().toISOString(),
        };
      }
    } else {
      item = {
        sku_id: dto.sku_id,
        product_id: dto.product_id,
        product_name: dto.product_name,
        product_slug: dto.product_slug,
        variant_name: dto.variant_name,
        color_name: dto.color_name,
        price: Number(dto.price || 0),
        original_price: dto.original_price ? Number(dto.original_price) : undefined,
        image: dto.image,
        quantity: Number(dto.quantity || 1),
        max_stock: Number(dto.max_stock || 99),
        added_at: new Date().toISOString(),
      };
    }

    await redis.hset(key, dto.sku_id, JSON.stringify(item));
    await redis.expire(key, CART_TTL_SECONDS);

    return this.getCart(cartKey);
  }

  async updateQuantity(cartKey: string, skuId: string, quantity: number): Promise<CartResponse> {
    const redis = this.redisService.getClient();
    const key = this.getCartKey(cartKey);

    if (quantity <= 0) {
      await redis.hdel(key, skuId);
    } else {
      const existingRaw = await redis.hget(key, skuId);
      if (existingRaw) {
        try {
          const item = JSON.parse(existingRaw) as CartStoredItem;
          item.quantity = quantity;
          await redis.hset(key, skuId, JSON.stringify(item));
          await redis.expire(key, CART_TTL_SECONDS);
        } catch {
          await redis.hdel(key, skuId);
        }
      }
    }

    return this.getCart(cartKey);
  }

  async removeItem(cartKey: string, skuId: string): Promise<CartResponse> {
    const redis = this.redisService.getClient();
    const key = this.getCartKey(cartKey);
    await redis.hdel(key, skuId);
    return this.getCart(cartKey);
  }

  async clearCart(cartKey: string): Promise<CartResponse> {
    const redis = this.redisService.getClient();
    const key = this.getCartKey(cartKey);
    await redis.del(key);
    return {
      cart_key: cartKey,
      items: [],
      item_count: 0,
      subtotal_amount: 0,
    };
  }
}
