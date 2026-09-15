import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for Storefront and Admin clients
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      /^http:\/\/localhost:[0-9]+$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

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
