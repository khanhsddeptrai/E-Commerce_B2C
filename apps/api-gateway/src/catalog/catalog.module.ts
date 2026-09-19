import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PRODUCT_PACKAGE_NAME, PRODUCT_PROTO_PATH } from '@repo/proto';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PRODUCT_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: PRODUCT_PACKAGE_NAME,
          protoPath: PRODUCT_PROTO_PATH,
          url: process.env.PRODUCT_GRPC_URL || 'localhost:50052',
          loader: {
            keepCase: true,
          },
        },
      },
    ]),
  ],
  controllers: [CatalogController],
  exports: [ClientsModule],
})
export class CatalogModule {}
