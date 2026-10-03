import { execFileSync } from 'child_process';
import * as path from 'path';
import { ProductPrismaClient } from '@repo/database';
import { assertTestDatabaseName, getTestProductDatabaseUrl } from './test-env';

const DATABASE_PACKAGE_DIR = path.resolve(__dirname, '../../../packages/database');

/** Tạo mới hoàn toàn database test (chỉ cho phép tên có hậu tố _test) */
async function recreateTestDatabase(testUrl: string): Promise<void> {
  const dbName = new URL(testUrl).pathname.replace(/^\//, '');
  assertTestDatabaseName(dbName);

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const admin = new ProductPrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.$disconnect();
  }
}

/** Áp dụng chuỗi migrations thật — kiểm tra luôn migrations dựng được database từ đầu */
function applyMigrations(schema: 'product', envName: string, testUrl: string): void {
  const prismaCli = require.resolve('prisma/build/index.js', { paths: [DATABASE_PACKAGE_DIR] });
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', `--schema=prisma/${schema}/schema.prisma`], {
    cwd: DATABASE_PACKAGE_DIR,
    env: { ...process.env, [envName]: testUrl },
    stdio: 'pipe',
  });
}

export default async function globalSetup(): Promise<void> {
  const productUrl = getTestProductDatabaseUrl();

  await recreateTestDatabase(productUrl);
  applyMigrations('product', 'PRODUCT_DATABASE_URL', productUrl);
}
