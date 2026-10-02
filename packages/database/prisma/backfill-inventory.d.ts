import type Redis from 'ioredis';
import type { PrismaClient as ProductPrismaClient } from '../src/generated/product-client';
import type { PrismaClient as OrderPrismaClient } from '../src/generated/order-client';

export interface BackfillInventorySummary {
  warehouseCode: string;
  initializedSkus: number;
  skippedSkus: number;
  committedReservations: number;
  holdReservations: number;
  redisKeys: number;
  warnings: string[];
}

export interface BackfillInventoryDeps {
  productPrisma: ProductPrismaClient;
  orderPrisma: OrderPrismaClient;
  redis: Redis;
  now?: Date;
  log?: (msg: string) => void;
}

export declare const DEFAULT_WAREHOUSE: { code: string; name: string };

export declare function backfillInventory(deps: BackfillInventoryDeps): Promise<BackfillInventorySummary>;
