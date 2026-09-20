import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrismaOrderService } from '../prisma/prisma-order.service';
import { ExpiredOrderWorker } from './expired-order.worker';

@Module({
  controllers: [OrderController],
  providers: [OrderService, PrismaOrderService, ExpiredOrderWorker],
  exports: [OrderService, ExpiredOrderWorker],
})
export class OrderModule {}
