import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Database riêng của order-service: product-service dùng order_db_test cho test backfill,
// tách tên để hai bộ test chạy song song không xóa database của nhau
const TEST_ORDER_DB_NAME = 'order_db_ordersvc_test';

const DEFAULT_ORDER_DATABASE_URL = 'postgresql://postgres:postgrespassword@localhost:5432/order_db?schema=public';

export function getTestOrderDatabaseUrl(): string {
  const parsed = new URL(process.env.ORDER_DATABASE_URL || DEFAULT_ORDER_DATABASE_URL);
  parsed.pathname = `/${TEST_ORDER_DB_NAME}`;
  return parsed.toString();
}

export function assertTestDatabaseName(dbName: string): void {
  if (!dbName.endsWith('_test')) {
    throw new Error(`Từ chối thao tác trên database "${dbName}": chỉ được chạy test trên database có hậu tố _test`);
  }
}
