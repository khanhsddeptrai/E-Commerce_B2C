import { execFileSync } from 'child_process';
import * as path from 'path';
import { OrderPrismaClient } from '@repo/database';
import { assertTestDatabaseName, getTestOrderDatabaseUrl } from './test-env';

const DATABASE_PACKAGE_DIR = path.resolve(__dirname, '../../../packages/database');

/** Tạo mới hoàn toàn database test (chỉ cho phép tên có hậu tố _test) rồi áp dụng migrations thật */
export default async function globalSetup(): Promise<void> {
  const testUrl = getTestOrderDatabaseUrl();
  const dbName = new URL(testUrl).pathname.replace(/^\//, '');
  assertTestDatabaseName(dbName);

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const admin = new OrderPrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.$disconnect();
  }

  const prismaCli = require.resolve('prisma/build/index.js', { paths: [DATABASE_PACKAGE_DIR] });
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema=prisma/order/schema.prisma'], {
    cwd: DATABASE_PACKAGE_DIR,
    env: { ...process.env, ORDER_DATABASE_URL: testUrl },
    stdio: 'pipe',
  });
}
