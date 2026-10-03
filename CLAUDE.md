@AGENTS.md

# Ghi chú làm việc cho Claude Code

## Ngôn ngữ
- **Luôn trả lời người dùng bằng tiếng Việt** (giải thích, báo cáo, câu hỏi, gợi ý commit). Thuật ngữ kỹ thuật, tên file, lệnh và code giữ nguyên tiếng Anh.

## Môi trường & lệnh
- Node được quản lý bằng **fnm** (`.nvmrc` = 22). Nếu shell không thấy `node`/`pnpm`, chạy qua: `fnm exec --using=22 -- pnpm.cmd <lệnh>` (trên Windows phải gọi `pnpm.cmd`).
- Package manager: `pnpm` (workspace) + Turborepo.
- **Kiểm tra sau khi sửa code:** `pnpm turbo run typecheck` (toàn repo) hoặc `pnpm --filter <app> typecheck`.
- **Test (Jest):** `pnpm turbo run test` hoặc `pnpm --filter <product-service|order-service> test`. Cần Docker đang chạy (Postgres + Redis).
  - Test đặt ở `apps/<service>/test/**/*.spec.ts`; dùng database test tạo mới mỗi lần chạy + `prisma migrate deploy` (product-service: `product_db_test` + `order_db_test` cho test backfill, Redis DB 15; order-service: `order_db_ordersvc_test`, dùng `FakeInventoryClient` thay cho gRPC thật). Helper có guard từ chối chạy trên DB không có hậu tố `_test`.
  - Test có tranh chấp đồng thời: kiểm chứng bằng cách tạm bỏ điều kiện chống trùng và xác nhận test fail (backup file vào scratchpad, không dùng `rm` với đường dẫn tương đối).
  - Lỗi đã biết nhưng chưa sửa được ghi bằng `test.failing` — khi sửa xong, đổi thành `it` thường.
  - Bắt buộc chạy test khi sửa bất kỳ logic tồn kho / đơn hàng nào.
- Chạy nhiều service cùng lúc: `pnpm turbo run dev --filter=api-gateway --filter=product-service` (không nối 2 lệnh `pnpm` trên một dòng).
- Hạ tầng: `docker compose -f docker/docker-compose.yml up -d` (Postgres 5432, Redis 6379, RabbitMQ 5672/15672, Mongo 27017, Meilisearch 7700).
- Gặp lỗi môi trường/cổng/gRPC/Prisma → tra `docs/troubleshooting/` trước.

## Kiến trúc thực tế (khác README ở vài chỗ)
- `apps/api-gateway` (REST :8000, prefix `api/v1`) → gRPC tới `auth-service` :50051, `product-service` :50052, `order-service` :50053, `payment-service` :50054.
- **Trang Admin nằm trong `apps/storefront/src/app/admin`**, chưa có `apps/admin`. Chưa có `packages/ui`, `tailwind-config`, `contracts`, `eslint-config`, `chat-service`.
- Storefront dùng Next.js 16 / React 19 / Tailwind v4 — đọc `apps/storefront/AGENTS.md` trước khi viết code Next.
- Storefront gọi API qua `src/services/*Service.ts`, kiểu dữ liệu trong `src/types/ecommerce.ts`.

## gRPC / Proto
- File `.proto` + interface TypeScript viết tay ở `packages/proto/src/` (`index.ts`). Khi thêm RPC phải sửa cả `.proto` lẫn interface trong `index.ts`.
- Loader dùng `keepCase: true` → field giữ nguyên `snake_case` (vd `full_name`) ở mọi tầng gRPC.
- Lỗi gRPC được map sang HTTP qua `apps/api-gateway/src/common/filters/grpc-exception.filter.ts`.
- **Tồn kho chỉ do product-service quản lý** (`InventoryService`, package `inventory`, cùng cổng :50052). Order-service không kết nối `product_db` / Redis; mọi thao tác kho sau khi tạo đơn đi qua bảng `stock_sync_tasks` + `StockSyncService` (xem `docs/06-wms-implementation-plan.md`).

## Database (Prisma)
- Mỗi database một thư mục riêng: `packages/database/prisma/{auth,product,order,payment}/schema.prisma`, mỗi thư mục có `migrations/` riêng (bắt đầu từ baseline `0_init`). **Không bao giờ để nhiều schema dùng chung một thư mục migrations** — migration của schema này sẽ sinh `DROP TABLE` bảng của schema khác.
- Generate: `pnpm db:generate` (tất cả) hoặc `pnpm --filter @repo/database db:<auth|product|order|payment>:generate`. Trên Windows phải tắt các service đang chạy trước, nếu không sẽ lỗi `EPERM` do engine bị khóa.
- Migrate: `db:<auth|product|order|payment>:migrate` (dev), `db:deploy:all` (áp dụng toàn bộ) — hỏi người dùng trước khi chạy migrate trên DB dev.
- Mỗi service tự nạp `.env` ở root trong `main.ts` trước khi bootstrap.

## Git & commit
- Commit theo Conventional Commits, `type(scope)` tiếng Anh, mô tả **tiếng Việt**, chữ thường, không dấu chấm cuối (xem skill `conventional-commit`).
- **Mặc định chỉ in nội dung commit (Summary + Description) để người dùng tự commit.** Chỉ chạy `git commit` khi người dùng yêu cầu rõ ràng. Không tự `git push`.

## Skills
- Skill dùng chung nằm ở `.agents/skills/`; `.claude/skills` là junction trỏ tới đó (không commit). Máy mới tạo lại bằng PowerShell:
  `New-Item -ItemType Junction -Path .claude\skills -Target (Resolve-Path .agents\skills).Path`
