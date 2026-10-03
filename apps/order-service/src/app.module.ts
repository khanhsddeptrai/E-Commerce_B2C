import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { OrderModule } from './order/order.module';
import { GrpcExceptionFilter } from './common/rpc-exception.filter';

@Module({
  imports: [OrderModule],
  providers: [{ provide: APP_FILTER, useClass: GrpcExceptionFilter }],
})
export class AppModule {}
