import { execFileSync } from 'child_process';
import * as path from 'path';
import { ProductPrismaClient } from '@repo/database';
import { assertTestDatabaseName, getTestProductDatabaseUrl } from './test-env';

const DATABASE_PACKAGE_DIR = path.resolve(__dirname, '../../../packages/database');

async function ensureDatabaseExists(testUrl: string): Promise<void> {
  const dbName = new URL(testUrl).pathname.replace(/^\//, '');
  assertTestDatabaseName(dbName);

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const admin = new ProductPrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    const rows = await admin.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${dbName}) AS "exists"
    `;
    if (!rows[0]?.exists) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.$disconnect();
  }
}

// Đồng bộ schema-product.prisma vào database test (dữ liệu được dọn giữa các test bằng resetProductDb).
// Dùng db push thay vì migrate deploy vì thư mục prisma/migrations hiện dùng chung cho 4 schema
// (migration của schema sau DROP bảng của schema trước) nên không áp dụng được lên database mới.
function pushSchema(testUrl: string): void {
  const prismaCli = require.resolve('prisma/build/index.js', { paths: [DATABASE_PACKAGE_DIR] });
  execFileSync(
    process.execPath,
    [prismaCli, 'db', 'push', '--schema=prisma/schema-product.prisma', '--skip-generate'],
    {
      cwd: DATABASE_PACKAGE_DIR,
      env: { ...process.env, PRODUCT_DATABASE_URL: testUrl },
      stdio: 'pipe',
    },
  );
}

export default async function globalSetup(): Promise<void> {
  const testUrl = getTestProductDatabaseUrl();
  await ensureDatabaseExists(testUrl);
  pushSchema(testUrl);
}
