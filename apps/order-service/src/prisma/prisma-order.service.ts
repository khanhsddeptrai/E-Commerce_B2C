import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OrderPrismaClient } from '@repo/database';

@Injectable()
export class PrismaOrderService extends OrderPrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url:
            process.env.ORDER_DATABASE_URL ||
            'postgresql://postgres:postgrespassword@localhost:5432/order_db?schema=public',
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
