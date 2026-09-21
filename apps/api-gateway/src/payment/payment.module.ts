import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PAYMENT_PACKAGE_NAME, PAYMENT_PROTO_PATH } from '@repo/proto';
import { PaymentController } from './payment.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PAYMENT_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: PAYMENT_PACKAGE_NAME,
          protoPath: PAYMENT_PROTO_PATH,
          url: process.env.PAYMENT_GRPC_URL || 'localhost:50054',
          loader: {
            keepCase: true,
          },
        },
      },
    ]),
  ],
  controllers: [PaymentController],
})
export class PaymentModule {}
