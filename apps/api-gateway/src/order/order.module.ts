import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ORDER_PACKAGE_NAME, ORDER_PROTO_PATH } from '@repo/proto';
import { OrderController } from './order.controller';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [
    CartModule,
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
  controllers: [OrderController],
})
export class OrderModule {}
