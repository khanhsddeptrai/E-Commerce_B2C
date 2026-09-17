# Chuyên Đề 03: Biến Môi Trường (.env), Prisma ORM & Database Migrations
**Vị trí:** `docs/troubleshooting/03-env-and-database.md`  
**Liên quan:** `packages/database`, `apps/auth-service`, `.env`

---

## 1. Sự Cố 1: Prisma Migrate Báo Lỗi P1012 (Thiếu Biến Môi Trường)

### Triệu chứng
Khi chạy lệnh migrate cơ sở dữ liệu:
```bash
pnpm --filter @repo/database db:migrate
```
Terminal xuất hiện thông báo lỗi:
```text
Prisma schema loaded from prisma\schema.prisma
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Environment variable not found: AUTH_DATABASE_URL.
  --> prisma\schema.prisma:3
   |
 2 | provider = "postgresql"
 3 | url = env("AUTH_DATABASE_URL")
   |
```

### Nguyên nhân
Trong mô hình Monorepo (pnpm workspace), khi chạy script trong thư mục con `packages/database`, Prisma CLI chỉ tìm file `.env` nằm trong cùng thư mục đó (`packages/database/.env`). Prisma không tự động leo ngược lên thư mục gốc của repository để tìm file `.env`.

### Cách khắc phục
Đảm bảo luôn tồn tại file `packages/database/.env` với nội dung chuẩn:
```env
AUTH_DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/auth_db?schema=public"
```
Khi cần chạy migration mới:
```bash
pnpm --filter @repo/database db:migrate
```

---

## 2. Sự Cố 2: NestJS Chạy Nhưng Prisma Không Kết Nối Được Database

### Triệu chứng
Service khởi động thành công, nhưng khi có request gửi vào thì báo lỗi không thể kết nối tới cơ sở dữ liệu hoặc `AUTH_DATABASE_URL` bị `undefined`.

### Nguyên nhân
1. Nest CLI (`nest start --watch`) không tự động đọc file `.env` vào `process.env`.
2. Do cơ chế hoisting của ES Module / TypeScript, các lệnh `import` của module được tải trước khi hàm nạp cấu hình kịp chạy.

### Cách khắc phục

#### 1. Nạp `dotenv` ở đầu file `main.ts` của microservice
```typescript
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Tự động tìm và nạp .env từ root hoặc local
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const envFile of envCandidates) {
  if (fs.existsSync(envFile)) dotenv.config({ path: envFile });
}
dotenv.config();
```

#### 2. Cấu hình URL tường minh kèm Fallback trong `PrismaService`
Trong file `src/prisma/prisma.service.ts`:
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@repo/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url:
            process.env.AUTH_DATABASE_URL ||
            'postgresql://postgres:postgrespassword@localhost:5432/auth_db?schema=public',
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
```
*Việc này đảm bảo ngay cả khi môi trường nạp trễ, Prisma vẫn có sẵn chuỗi kết nối mặc định an toàn.*

---

## 3. Bản Đồ File `.env` Trong Toàn Bộ Dự Án

Để hệ thống hoạt động ổn định nhất, dự án duy trì các vị trí file `.env` như sau:

| Vị trí file | Vai trò | Các biến quan trọng |
| :--- | :--- | :--- |
| `/.env` | Nguồn sự thật duy nhất (Single Source of Truth) | Tất cả URL, JWT Secrets, Ports, RabbitMQ, Redis, Meilisearch |
| `/packages/database/.env` | Dành riêng cho Prisma CLI | `AUTH_DATABASE_URL`, `PRODUCT_DATABASE_URL`, ... |
| `/apps/auth-service/.env` | Bản sao phục vụ Nest CLI khi chạy cục bộ | `AUTH_DATABASE_URL`, `JWT_ACCESS_SECRET`, `AUTH_GRPC_PORT` |
| `/apps/api-gateway/.env` | Bản sao phục vụ API Gateway | `PORT_API_GATEWAY`, `AUTH_GRPC_URL`, `JWT_ACCESS_SECRET` |
