import { Provider } from '@nestjs/common';
import { ClientGrpc, ClientsModule, Transport } from '@nestjs/microservices';
import { INVENTORY_PACKAGE_NAME, INVENTORY_PROTO_PATH, InventoryServiceClient } from '@repo/proto';

/** Token inject InventoryServiceClient (gRPC tới Product Service :50052); test thay bằng client giả */
export const INVENTORY_CLIENT = 'INVENTORY_CLIENT';
const INVENTORY_GRPC = 'INVENTORY_GRPC';

export const InventoryGrpcClientModule = ClientsModule.register([
  {
    name: INVENTORY_GRPC,
    transport: Transport.GRPC,
    options: {
      package: INVENTORY_PACKAGE_NAME,
      protoPath: INVENTORY_PROTO_PATH,
      url: process.env.PRODUCT_GRPC_URL || 'localhost:50052',
      loader: { keepCase: true },
    },
  },
]);

export const inventoryClientProvider: Provider = {
  provide: INVENTORY_CLIENT,
  useFactory: (grpc: ClientGrpc): InventoryServiceClient => grpc.getService<InventoryServiceClient>('InventoryService'),
  inject: [INVENTORY_GRPC],
};
