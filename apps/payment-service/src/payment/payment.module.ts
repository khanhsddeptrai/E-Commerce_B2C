import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ORDER_PACKAGE_NAME, ORDER_PROTO_PATH } from '@repo/proto';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaPaymentService } from '../prisma/prisma-payment.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ORDER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: ORDER_PACKAGE_NAME,
          protoPath: ORDER_PROTO_PATH,
          url: process.env.ORDER_GRPC_URL || 'localhost:50053',
          loader: {
            keepCase: true,
          },
        },
      },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PrismaPaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
