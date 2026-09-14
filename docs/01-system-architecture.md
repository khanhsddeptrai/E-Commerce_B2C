# 01. Kiến Trúc Hệ Thống (System Architecture Specification)

> Tài liệu này mô tả chi tiết trách nhiệm, ranh giới nghiệp vụ (Bounded Contexts), giao thức kết nối và phân bổ hạ tầng mạng cho API Gateway và các Microservices.

---

## 1. Nguyên Tắc Thiết Kế Cốt Lõi

1. **Pragmatic Microservices**: Thiết kế phân tán theo từng domain nghiệp vụ độc lập, tránh distributed monolith bằng cách cô lập database và ranh giới code.
2. **Hybrid Communication (Đồng bộ + Bất đồng bộ)**:
   * **gRPC (HTTP/2 + Protocol Buffers)**: Sử dụng cho mọi truy vấn đồng bộ nội bộ (Request - Response) đòi hỏi độ trễ cực thấp (< 5ms) và tính an toàn kiểu dữ liệu (Type-Safety).
   * **RabbitMQ**: Sử dụng cho toàn bộ sự kiện bất đồng bộ (Event-Driven), điều phối SAGA, và chạy các tác vụ nền (Background jobs) nhằm tách rời (decouple) sự phụ thuộc giữa các services.
3. **Database-per-Service**: Mỗi service sở hữu database riêng biệt, tuyệt đối không query chéo database của service khác.
4. **Resilience & Fault Tolerance**: Tích hợp Timeout, Retry có Exponential Backoff, Dead Letter Queue (DLQ) trên RabbitMQ và Circuit Breaker khi cần thiết.

---

## 2. Danh Mục Các Dịch Vụ (Services Specification)

### 2.1. API Gateway Service (BFF - Backend For Frontend)
* **Loại dịch vụ**: Public Ingress / Reverse Proxy / Aggregator.
* **Giao thức tiếp nhận**: RESTful API (HTTP/1.1 & HTTP/2) và WebSockets từ Storefront & Admin.
* **Nhiệm vụ chính**:
  * **Routing & Reverse Proxy**: Tiếp nhận request từ các client bên ngoài, chuyển tiếp sang các gRPC method tương ứng của từng service.
  * **Authentication & Context Forwarding**: Xác thực JWT token, trích xuất thông tin user (ID, Role, Email) và gắn vào gRPC Metadata để chuyển tiếp vào các microservice nội bộ.
  * **Rate Limiting**: Sử dụng Redis để giới hạn tần suất request theo IP và User ID, chống tấn công DDoS và spam API.
  * **BFF & Data Aggregation**: Gom dữ liệu từ nhiều service trong 1 lần gọi (ví dụ: Trang chi tiết đơn hàng cần gọi cả Order Service và Payment Service).

### 2.2. Auth & User Service
* **Cơ sở dữ liệu**: PostgreSQL (`auth_db`).
* **Giao tiếp**:
  * **Inbound**: gRPC (API Gateway gọi vào để `Login`, `Register`, `ValidateToken`, `GetUserProfile`).
  * **Outbound**: RabbitMQ (Phát event `UserRegistered`).
* **Nhiệm vụ chính**:
  * Quản lý vòng đời tài khoản, băm mật khẩu với thuật toán an toàn (`Argon2id`).
  * Cấp phát và xoay vòng JWT (Access Token hạn ngắn + Refresh Token lưu DB có cơ chế thu hồi).
  * Quản lý phân quyền RBAC (`CUSTOMER`, `ADMIN`, `SUPPORT`).
  * Quản lý sổ địa chỉ giao hàng và thông tin cá nhân.

### 2.3. Product & Catalog Service
* **Cơ sở dữ liệu**: PostgreSQL (`product_db`) + Meilisearch.
* **Giao tiếp**:
  * **Inbound**: gRPC (Lấy danh mục, danh sách sản phẩm, chi tiết SKU, kiểm tra giá).
  * **Outbound**: RabbitMQ (Phát event `ProductCreated`, `ProductUpdated`, `ProductDeleted`).
* **Nhiệm vụ chính**:
  * Quản lý phân cấp danh mục (Category tree), thương hiệu (Brand).
  * Quản lý sản phẩm cha và các biến thể SKU (Màu sắc, kích thước, ảnh đại diện, giá niêm yết, tồn kho cơ sở).
  * Tự động đồng bộ dữ liệu sang Meilisearch thông qua Worker lắng nghe sự kiện RabbitMQ.

### 2.4. Order & Inventory Service (Core Orchestrator)
* **Cơ sở dữ liệu**: PostgreSQL (`order_db`) + Redis (Distributed State).
* **Giao tiếp**:
  * **Inbound**: gRPC (Tạo đơn hàng, tra cứu lịch sử đơn hàng, cập nhật trạng thái).
  * **Outbound/Bilateral**: RabbitMQ (Điều phối luồng SAGA Orchestration, nhận kết quả thanh toán).
* **Nhiệm vụ chính**:
  * Quản lý giỏ hàng tức thời (Cart) lưu trữ tại Redis Hash.
  * **Inventory Reservation**: Giữ kho tạm thời (Hold stock) bằng Redis Lua script khi khách đặt hàng.
  * **SAGA Orchestrator**: Điều phối toàn bộ trạng thái đơn hàng và kích hoạt giao dịch bù (Compensation) nếu thanh toán thất bại.
  * Quản lý mã giảm giá (Voucher) và đếm lượt dùng nguyên tử (Atomic counter).

### 2.5. Payment Service
* **Cơ sở dữ liệu**: PostgreSQL (`payment_db`).
* **Giao tiếp**:
  * **Inbound**: gRPC (Tạo URL thanh toán, kiểm tra trạng thái thanh toán), Webhook Ingress (từ VNPAY/MoMo/Stripe).
  * **Outbound**: RabbitMQ (Phát event `PaymentSucceeded`, `PaymentFailed`).
* **Nhiệm vụ chính**:
  * Tích hợp cổng thanh toán trực tuyến (VNPAY, MoMo, Stripe) và hỗ trợ COD.
  * **Idempotency Control**: Đảm bảo an toàn tuyệt đối, không trừ tiền 2 lần khi client retry request hoặc webhook bị gửi trùng lặp.
  * Tiếp nhận, xác minh chữ ký số (Checksum/Signature) của Webhook và hoàn tiền (Refund).

### 2.6. Notification & Chat Service
* **Cơ sở dữ liệu**: MongoDB (`chat_db`).
* **Giao tiếp**:
  * **Inbound**: Socket.io (Client kết nối trực tiếp phòng chat CSKH).
  * **Inbound (Event)**: RabbitMQ (Lắng nghe `OrderConfirmed`, `OrderShipped` để gửi email/thông báo).
* **Nhiệm vụ chính**:
  * Kết nối WebSocket thời gian thực giữa Khách hàng và nhân viên hỗ trợ Admin.
  * Lưu trữ lịch sử tin nhắn, hình ảnh, thẻ sản phẩm, trạng thái đã xem (`seen`).
  * Gửi email tự động (Hóa đơn điện tử, thông báo trạng thái đơn hàng).

---

## 3. Bảng Định Tuyến & Cổng Mạng (Network & Port Allocation)

| Dịch Vụ | Container Name | Giao Thức Ngoài | Cổng Ngoài (Host) | Giao Thức Nội Bộ | Cổng Nội Bộ (gRPC / Socket) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Storefront Web** | `b2c-storefront` | HTTP | `3000` | - | - |
| **Admin Dashboard**| `b2c-admin` | HTTP | `3001` | - | - |
| **API Gateway** | `b2c-api-gateway`| HTTP / REST | `8000` | gRPC Client | - |
| **Auth Service** | `b2c-auth-service`| - | - | gRPC | `50051` |
| **Product Service**| `b2c-product-service`| - | - | gRPC | `50052` |
| **Order Service** | `b2c-order-service`| - | - | gRPC | `50053` |
| **Payment Service**| `b2c-payment-service`| HTTP (Webhook)| `8004` | gRPC | `50054` |
| **Chat Service** | `b2c-chat-service` | WSS / Socket.io | `8005` | Event Consumer | - |

---

## 4. Ma Trận Phiên Bản & Docker Images (Tech Stack Version Matrix)

| Thành Phần | Gói / Docker Image | Phiên Bản Khuyên Dùng | Ghi Chú Kỹ Thuật |
| :--- | :--- | :--- | :--- |
| **Runtime** | `Node.js` | `v20.18.x LTS` hoặc `v22.x LTS` | Hỗ trợ Native Fetch, ESM và hiệu năng V8 tối ưu |
| **Package Manager** | `pnpm` | `^9.10.x` | Tương thích hoàn hảo với Turborepo workspace |
| **Monorepo Engine** | `turbo` | `^2.10.x` | Build caching từ xa, pipeline tasks song song |
| **Frontend Framework**| `next` | `^16.x` (App Router) | React 19.3+, Server Actions, Partial Prerendering (PPR) |
| **UI Library** | `shadcn/ui` + `tailwindcss` | `Tailwind v4.3.x`, Radix UI | Oxide engine Rust siêu tốc, chuẩn CSS @theme |
| **Backend Framework** | `@nestjs/core`, `@nestjs/microservices` | `^12.x` | Hỗ trợ NestJS microservices gRPC và WebSockets |
| **gRPC Runtime** | `@grpc/grpc-js` + `ts-proto` | `@grpc/grpc-js ^1.14.x`, `ts-proto ^2.0.x` | Sinh code TypeScript tự động từ file `.proto` |
| **Database RDBMS** | `postgres` (Docker) | `postgres:18-alpine` | PostgreSQL 18 tối ưu query planner, SIMD JSONB & parallel vacuum |
| **ORM Client** | `prisma`, `@prisma/client`| `^6.x` | Type-safe query engine, tự động sinh migrations |
| **Connection Pooler** | `pgbouncer` (Docker) | `edoburu/pgbouncer:v1.23.1` | Quản lý connection pool, tránh nghẽn `max_connections` |
| **Message Broker** | `rabbitmq` (Docker) | `rabbitmq:4.3-management-alpine` | Giao diện quản trị web cổng `15672`, hỗ trợ Quorum Queues |
| **NoSQL Database** | `mongo` (Docker) | `mongo:8.0` | WiredTiger engine thế hệ mới cho thông lượng ghi chat cực lớn |
| **Search Engine** | `meilisearch` (Docker)| `getmeili/meilisearch:v1.53` | Cổng `7700`, tìm kiếm tiếng Việt tức thì |
| **Cache & Lock** | `redis` (Docker) | `redis:8.8-alpine` | Cổng `6379`, Redis 8 hiệu năng cao, Lua Scripting |
| **Redis Client** | `ioredis` | `^6.0.x` | Hỗ trợ Cluster, Sentinel, Pipeline và Redlock |
| **Realtime** | `socket.io` | `^4.8.x` | WebSocket engine cho kênh chat trực tuyến CSKH |

---

## 5. Danh Mục Event Bus (RabbitMQ Topology)

### Exchanges & Queues Chính:
* **Exchange**: `ecommerce.events` (Topic Exchange)
  * `order.created` $\rightarrow$ `payment_service_queue` (Tạo yêu cầu thanh toán).
  * `payment.succeeded` $\rightarrow$ `order_service_queue` (Cập nhật `CONFIRMED`) & `notification_queue` (Gửi Email).
  * `payment.failed` $\rightarrow$ `order_service_queue` (Trigger Compensation: Nhả kho, chuyển trạng thái `CANCELLED`).
  * `product.updated` $\rightarrow$ `search_sync_queue` (Đồng bộ sang Meilisearch).
* **Dead Letter Exchange (DLX)**: `ecommerce.dlx` $\rightarrow$ Lưu trữ các message xử lý lỗi quá số lần quy định để kiểm tra thủ công.
