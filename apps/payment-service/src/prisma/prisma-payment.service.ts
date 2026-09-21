import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PaymentPrismaClient } from '@repo/database';

@Injectable()
export class PrismaPaymentService extends PaymentPrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url:
            process.env.PAYMENT_DATABASE_URL ||
            'postgresql://postgres:postgrespassword@localhost:5432/payment_db?schema=public',
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
