import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrismaOrderService } from '../prisma/prisma-order.service';

@Module({
  controllers: [OrderController],
  providers: [OrderService, PrismaOrderService],
  exports: [OrderService],
})
export class OrderModule {}
