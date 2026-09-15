import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { AUTH_PROTO_PATH, AUTH_PACKAGE_NAME } from '@repo/proto';

async function bootstrap() {
  const port = process.env.AUTH_GRPC_PORT || '50051';
  const host = process.env.AUTH_GRPC_HOST || '0.0.0.0';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: AUTH_PACKAGE_NAME,
      protoPath: AUTH_PROTO_PATH,
      url: `${host}:${port}`,
    },
  });

  await app.listen();
  console.log(`🚀 [Auth Service] gRPC Microservice is listening on ${host}:${port}`);
}

bootstrap();
