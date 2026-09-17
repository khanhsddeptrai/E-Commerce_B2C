# Sổ Tay Chẩn Đoán & Khắc Phục Sự Cố (Troubleshooting Hub)
**Dự án:** E-Commerce B2C Single-Brand (NovaTech)  
**Vị trí:** `docs/troubleshooting/`  
**Mục đích:** Trung tâm tra cứu và tài liệu phân loại các lỗi phát sinh trong quá trình thiết lập, vận hành hạ tầng và phát triển microservices.

---

## Danh Mục Phân Loại Sự Cố

Tài liệu được chia thành các chuyên đề độc lập để dễ tra cứu, mở rộng và cập nhật nhanh:

```text
docs/troubleshooting/
├── README.md                      # Mục lục điều hướng tổng quan (Tài liệu này)
├── 01-ports-and-processes.md      # Xung đột cổng mạng (EADDRINUSE) & Quản lý tiến trình
├── 02-grpc-and-protobuf.md        # Lỗi giao tiếp gRPC, keepCase Protobuf & Exception Filters
├── 03-env-and-database.md         # Biến môi trường .env, Prisma ORM & Database Migrations
├── 04-monorepo-and-scripts.md     # Cú pháp chạy lệnh Monorepo, Turborepo & pnpm filter
├── 05-docker-and-infra.md         # Docker Desktop, WSL 2, Network Timeout & Container Health
└── 06-gui-and-tools.md            # Hướng dẫn kết nối công cụ trực quan (DBeaver, TablePlus...)
```

---

## Bảng Tra Cứu Sự Cố Nhanh Theo Hiện Tượng

| Hiện tượng / Thông báo lỗi | Nguyên nhân chính | Xem tài liệu chi tiết |
| :--- | :--- | :--- |
| `listen EADDRINUSE: address already in use 0.0.0.0:50051 / 8000` | Tiến trình Node.js cũ vẫn đang chiếm cổng | [01-ports-and-processes.md](01-ports-and-processes.md) |
| Gọi API trả về `500`, trường `full_name` bị thiếu trong database | `@grpc/proto-loader` đổi `snake_case` sang `camelCase` | [02-grpc-and-protobuf.md](02-grpc-and-protobuf.md) |
| Sai mật khẩu / trùng email nhưng API Gateway trả về HTTP `500` | Thiếu bộ lọc chuyển đổi mã lỗi gRPC sang REST HTTP | [02-grpc-and-protobuf.md](02-grpc-and-protobuf.md) |
| `P1012: Environment variable not found: AUTH_DATABASE_URL` | Nest CLI hoặc Prisma CLI không tìm thấy file `.env` | [03-env-and-database.md](03-env-and-database.md) |
| Prisma không kết nối được PostgreSQL khi chạy microservice | Thiếu cấu hình URL tường minh hoặc nạp dotenv trễ | [03-env-and-database.md](03-env-and-database.md) |
| Gõ lệnh chạy 2 service bị lỗi cú pháp hoặc chỉ 1 service chạy | Gõ liên tiếp 2 lệnh `pnpm` trên một dòng terminal | [04-monorepo-and-scripts.md](04-monorepo-and-scripts.md) |
| `ReferenceError: __dirname is not defined in ES module scope` | Lỗi tương thích CommonJS và ESM trong Node 22+ | [04-monorepo-and-scripts.md](04-monorepo-and-scripts.md) |
| Docker engine không kết nối được / kéo image bị timeout | Docker Desktop chưa bật / WSL 2 chưa cài đặt | [05-docker-and-infra.md](05-docker-and-infra.md) |
| Muốn xem các bảng trong PostgreSQL nhưng không biết thông tin | Cần thông số host, port, credentials để kết nối GUI | [06-gui-and-tools.md](06-gui-and-tools.md) |
