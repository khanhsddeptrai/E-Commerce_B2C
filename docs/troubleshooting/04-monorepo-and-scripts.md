# Chuyên Đề 04: Cú Pháp Chạy Lệnh Monorepo, Turborepo & pnpm
**Vị trí:** `docs/troubleshooting/04-monorepo-and-scripts.md`  
**Liên quan:** `package.json`, `turbo.json`, `pnpm-workspace.yaml`

---

## 1. Sự Cố 1: Lệnh Gộp 2 Service Bị Lỗi Cú Pháp

### Triệu chứng
Gõ lệnh vào terminal:
```bash
pnpm --filter api-gateway dev pnpm --filter auth-service dev
```
Bị lỗi: `Unknown argument: pnpm` hoặc chỉ có `api-gateway` được khởi chạy, `auth-service` hoàn toàn không hoạt động.

### Nguyên nhân
Trong các trình thông dịch lệnh (PowerShell, Bash, Zsh), cú pháp của `pnpm` là:
```bash
pnpm --filter <tên_package> <tên_script> [...các tham số truyền vào script]
```
Do đó, toàn bộ phần văn bản phía sau chữ `dev` (`pnpm --filter auth-service dev`) bị `pnpm` hiểu là các đối số (arguments) truyền cho lệnh `nest start --watch` của `api-gateway`, dẫn đến lỗi cú pháp.

### Cách chạy đúng chuẩn

#### Cách 1: Sử dụng Turborepo (Khuyên dùng - 1 dòng lệnh)
Tại thư mục gốc của repository, chạy:
```bash
pnpm turbo run dev --filter=auth-service --filter=api-gateway
```
*Ưu điểm: Turborepo sẽ điều phối chạy song song 2 service trong cùng 1 cửa sổ terminal, tự động gắn nhãn tiền tố tên service cho từng dòng log.*

#### Cách 2: Mở 2 cửa sổ terminal riêng biệt
- **Cửa sổ 1 (Chạy Auth Microservice):**
  ```bash
  pnpm --filter auth-service dev
  ```
- **Cửa sổ 2 (Chạy API Gateway REST):**
  ```bash
  pnpm --filter api-gateway dev
  ```

---

## 2. Sự Cố 2: Lỗi ESM `__dirname is not defined` trong Node 22+

### Triệu chứng
Khi build hoặc chạy code TypeScript có dùng `packages/proto`:
```text
ReferenceError: __dirname is not defined in ES module scope
    at getProtoPath (...)
```

### Nguyên nhân
Trong các phiên bản Node.js hiện đại (Node 20.12+ và Node 22+), khi một gói package sử dụng định dạng ES Module (`"type": "module"`), biến toàn cục `__dirname` của CommonJS bị loại bỏ.

### Giải pháp xử lý chuẩn
Trong file [packages/proto/src/index.ts](file:///d:/MyProject/E-Commerce_B2C/packages/proto/src/index.ts), sử dụng hàm bọc helper `getProtoPath()` có cơ chế fallback kép:
```typescript
function getProtoPath(filename: string): string {
  let baseDir = '';
  try {
    // Thử dùng __dirname nếu chạy dưới môi trường CommonJS
    // @ts-ignore
    baseDir = __dirname;
  } catch {
    // Fallback sang import.meta.dirname của Node 20.11+ / Node 22+ ESM
    // @ts-ignore
    baseDir = import.meta.dirname || '';
  }

  const candidates = [
    path.resolve(baseDir, filename),
    path.resolve(baseDir, '../src', filename),
    path.resolve(process.cwd(), 'packages/proto/src', filename),
    path.resolve(process.cwd(), '../packages/proto/src', filename),
    path.resolve(process.cwd(), '../../packages/proto/src', filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}
```
*Giải pháp này đảm bảo mã nguồn chạy ổn định trên cả môi trường CommonJS (`ts-node`), ESM (`node --loader`) và Next.js bundler.*
