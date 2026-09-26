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
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GrpcToHttpExceptionFilter } from './common/filters/grpc-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cookie parser middleware cho HttpOnly authentication cookies
  app.use(cookieParser());

  // Enable CORS for Storefront and Admin clients
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    ...(isProduction ? [] : [/^http:\/\/localhost:[0-9]+$/]),
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Global Exception Filter for gRPC errors
  app.useGlobalFilters(new GrpcToHttpExceptionFilter());

  // Enable automatic DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT_API_GATEWAY || process.env.PORT || 8000;
  await app.listen(port);
  console.log(`🌐 [API Gateway] BFF REST server is listening on http://localhost:${port}`);
}

bootstrap();
