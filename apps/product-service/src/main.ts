import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Nạp cấu hình biến môi trường từ root .env hoặc local .env
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const envFile of envCandidates) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { PRODUCT_PROTO_PATH, PRODUCT_PACKAGE_NAME } from '@repo/proto';

async function bootstrap() {
  const port = process.env.PRODUCT_GRPC_PORT || '50052';
  const host = process.env.PRODUCT_GRPC_HOST || '0.0.0.0';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: PRODUCT_PACKAGE_NAME,
      protoPath: PRODUCT_PROTO_PATH,
      url: `${host}:${port}`,
      loader: {
        keepCase: true,
      },
    },
  });

  await app.listen();
  console.log(`🚀 [Product Service] gRPC Microservice is listening on ${host}:${port}`);
}

bootstrap();
