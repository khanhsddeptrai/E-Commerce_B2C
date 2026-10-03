import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { INVENTORY_PACKAGE_NAME, INVENTORY_PROTO_PATH } from '@repo/proto';
import { InventoryController } from './inventory.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    ClientsModule.register([
      {
        name: 'INVENTORY_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: INVENTORY_PACKAGE_NAME,
          protoPath: INVENTORY_PROTO_PATH,
          // InventoryService chạy chung tiến trình gRPC với Product Service
          url: process.env.PRODUCT_GRPC_URL || 'localhost:50052',
          loader: {
            keepCase: true,
          },
        },
      },
    ]),
  ],
  controllers: [InventoryController],
})
export class InventoryModule {}
