# 05. Lộ Trình Triển Khai (Implementation Roadmap & Milestones)

> Tài liệu này vạch ra 5 giai đoạn phát triển chi tiết từ việc thiết lập hạ tầng Monorepo đến khi hệ thống sẵn sàng triển khai thực tế.

---

## Giai Đoạn 1: Khởi Tạo Nền Tảng (Foundation & Infrastructure)
* **Mục tiêu**: Thiết lập bộ khung Monorepo, container hạ tầng và kênh liên lạc gRPC đầu tiên.
* **Các công việc cụ thể**:
  - [x] Khởi tạo Monorepo bằng **Turborepo** với cấu trúc `apps/` và `packages/`.
  - [x] Viết file `docker/docker-compose.yml` chạy các dịch vụ: PostgreSQL (kèm PgBouncer), Redis Cluster, RabbitMQ, MongoDB, Meilisearch.
  - [x] Thiết lập `packages/proto`: Định nghĩa file `.proto` đầu tiên và viết script sinh code TypeScript.
  - [x] Thiết lập `packages/database`: Cấu hình Prisma schema và migration cho `auth_db`.
  - [x] Xây dựng **Auth Service**: Đăng ký, đăng nhập, JWT authentication, cấp refresh token.
  - [x] Xây dựng **API Gateway (BFF)**: Cấu hình Ingress, routing gRPC sang Auth Service, Auth Guard.

---

## Giai Đoạn 2: Quản Lý Sản Phẩm & Giao Diện Mua Sắm (Catalog & Storefront)
* **Mục tiêu**: Hoàn thiện luồng duyệt sản phẩm, tìm kiếm Meilisearch và giao diện Storefront.
* **Các công việc cụ thể**:
  - [ ] Thiết lập `product_db`: Tạo bảng Danh mục, Thương hiệu, Sản phẩm và SKU biến thể.
  - [ ] Xây dựng **Product Service**: CRUD sản phẩm, phát sự kiện `product.updated` sang RabbitMQ.
  - [ ] Tích hợp **Meilisearch Worker**: Lắng nghe sự kiện từ RabbitMQ để đánh chỉ mục (Index) tìm kiếm.
  - [ ] Thiết lập `packages/tailwind-config` & `packages/ui` (Button, Input, ProductCard, Skeleton).
  - [x] Xây dựng **Storefront App (Next.js - apps/storefront)**:
  - [x] Trang chủ NovaTech (Hero Flagship LDAC, Flash Sale đếm ngược, Danh mục).
  - [x] Trang danh mục sản phẩm (Bộ lọc giá/danh mục, tìm kiếm, phân loại).
  - [x] Trang chi tiết sản phẩm (Bộ chọn màu/cấu hình động, bảng thông số kỹ thuật).
  - [x] Giỏ hàng trượt (Cart Drawer) & Trang đặt hàng (Checkout mô phỏng).
  - [x] Tầng Mock Data Service (Chuẩn bị sẵn cho việc nối API Gateway).


---

## Giai Đoạn 3: Giỏ Hàng, Quản Lý Kho & Đơn Hàng (Cart, Inventory & Order)
* **Mục tiêu**: Vận hành giỏ hàng tức thời và cơ chế đặt hàng có bảo vệ tồn kho Flash Sale.
* **Các công việc cụ thể**:
  - [ ] Xây dựng **Giỏ hàng trên Redis**: Thêm/sửa/xóa sản phẩm bằng Redis Hash.
  - [ ] Viết **Redis Lua Script**: Kiểm tra và giữ kho tức thì (`Hold stock`) với TTL 15 phút.
  - [ ] Xây dựng **Order Service**:
    - Thiết lập `order_db` (Bảng `orders`, `order_items`, `inventory_reservations`, `vouchers`).
    - API tạo đơn hàng (Create Checkout) kèm kiểm tra mã giảm giá (Atomic Counter).
    - Quản lý vòng đời trạng thái đơn hàng (Order State Machine).

---

## Giai Đoạn 4: Thanh Toán & SAGA Orchestration (Payment & Consistency)
* **Mục tiêu**: Tích hợp cổng thanh toán trực tuyến và hoàn thiện quy trình giao dịch phân tán an toàn.
* **Các công việc cụ thể**:
  - [ ] Xây dựng **Payment Service**:
    - Thiết lập `payment_db`.
    - Tích hợp cổng thanh toán giả lập hoặc trực tuyến (VNPAY Sandbox / MoMo / Stripe).
    - Xử lý **Idempotency Key** và cơ chế xác thực Webhook/IPN.
  - [ ] Hoàn thiện **SAGA Orchestrator tại Order Service**:
    - Nhận event `PaymentSucceeded` $\rightarrow$ Xác nhận đơn `CONFIRMED` $\rightarrow$ Trừ kho thật.
    - Nhận event `PaymentFailed` $\rightarrow$ Hủy đơn `CANCELLED` $\rightarrow$ Nhả kho Redis.
  - [ ] Áp dụng **Transactional Outbox Pattern**: Ngăn chặn tình trạng Dual-Write thất thoát sự kiện.
  - [ ] Hoàn thiện màn hình Checkout và Trang tra cứu lịch sử đơn hàng trên Storefront.

---

## Giai Đoạn 5: Realtime Chat, Admin Dashboard & Hoàn Thiện (Launch Ready)
* **Mục tiêu**: Xây dựng kênh chat CSKH thời gian thực, giao diện quản trị Admin và kiểm thử toàn diện.
* **Các công việc cụ thể**:
  - [ ] Xây dựng **Notification & Chat Service**:
    - Kết nối WebSocket hai chiều với **Socket.io** (`@nestjs/platform-socket.io`).
    - Lưu lịch sử tin nhắn vào **MongoDB**.
    - Gửi email tự động khi đơn hàng thay đổi trạng thái.
  - [ ] Xây dựng **Admin Dashboard (Next.js + Shadcn UI)**:
    - Quản lý sản phẩm, biến thể, kho hàng (TanStack Table).
    - Quản lý danh sách đơn hàng và cập nhật trạng thái vận chuyển.
    - Giao diện tiếp nhận phiên chat CSKH trực tiếp với khách hàng.
  - [ ] **Kiểm thử & Triển khai**:
    - Viết Unit Tests (Jest) và E2E Tests (Playwright).
    - Cấu hình CI/CD Pipeline với GitHub Actions.
    - Viết `docker-compose.apps.yml` khởi chạy trọn gói toàn bộ hệ thống.
