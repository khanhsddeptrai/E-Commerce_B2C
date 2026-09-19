import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ProductPrismaClient } from '@repo/database';

@Injectable()
export class PrismaProductService extends ProductPrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url:
            process.env.PRODUCT_DATABASE_URL ||
            'postgresql://postgres:postgrespassword@localhost:5432/product_db?schema=public',
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
