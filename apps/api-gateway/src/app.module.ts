import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { RedisModule } from './redis/redis.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';

@Module({
  imports: [RedisModule, CartModule, OrderModule, AuthModule, CatalogModule],
})
export class AppModule {}
