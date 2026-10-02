import * as dotenv from 'dotenv';
import * as path from 'path';

// Redis DB riêng cho test của product-service (order-service dùng DB 14) để chạy song song không đụng nhau
export const TEST_REDIS_DB = 15;

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_PRODUCT_DATABASE_URL = 'postgresql://postgres:postgrespassword@localhost:5432/product_db?schema=public';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

/** Đổi tên database trong URL sang <tên>_test, không bao giờ trỏ vào database dev */
export function toTestDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    parsed.pathname = `/${dbName}_test`;
  }
  return parsed.toString();
}

export function toTestRedisUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${TEST_REDIS_DB}`;
  return parsed.toString();
}

export function getTestProductDatabaseUrl(): string {
  return toTestDatabaseUrl(process.env.PRODUCT_DATABASE_URL || DEFAULT_PRODUCT_DATABASE_URL);
}

export function getTestRedisUrl(): string {
  return toTestRedisUrl(process.env.REDIS_URL || DEFAULT_REDIS_URL);
}

export function assertTestDatabaseName(dbName: string): void {
  if (!dbName.endsWith('_test')) {
    throw new Error(`Từ chối thao tác trên database "${dbName}": chỉ được chạy test trên database có hậu tố _test`);
  }
}
