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
  - [x] Xây dựng **Giỏ hàng trên Redis**: Thêm/sửa/xóa sản phẩm bằng Redis Hash (`cart:{userId}` / `cart:{guestSessionId}`).
  - [x] Viết **Redis Lua Script**: Kiểm tra và giữ kho tức thì (`Hold stock`) nguyên tử với TTL 15 phút.
  - [x] Xây dựng **Order Service**:
    - [x] Thiết lập `order_db` (Bảng `orders`, `order_items`, `inventory_reservations`).
    - [x] API tạo đơn hàng (Create Checkout) kèm định dạng mã chuẩn `ORD-YYMMDD-XXXX`.
    - [ ] Quản lý vòng đời trạng thái đơn hàng (Order State Machine hoàn chỉnh).

---

## Giai Đoạn 4: Thanh Toán, Vận Chuyển & SAGA Orchestration (Payment, Logistics & Consistency)
* **Mục tiêu**: Tích hợp cổng thanh toán trực tuyến, hoàn thiện quy trình giao dịch phân tán an toàn và hệ thống giả lập vận chuyển thông minh.
* **Các công việc cụ thể**:
  - [ ] Xây dựng **Payment Service**:
    - Thiết lập `payment_db`.
    - Tích hợp cổng thanh toán giả lập hoặc trực tuyến (VNPAY Sandbox / MoMo / Stripe).
    - Xử lý **Idempotency Key** và cơ chế xác thực Webhook/IPN.
  - [ ] Hoàn thiện **SAGA Orchestrator tại Order Service**:
    - Nhận event `PaymentSucceeded` $\rightarrow$ Xác nhận đơn `CONFIRMED` $\rightarrow$ Trừ kho thật.
    - Nhận event `PaymentFailed` $\rightarrow$ Hủy đơn `CANCELLED` $\rightarrow$ Nhả kho Redis.
  - [ ] Áp dụng **Transactional Outbox Pattern**: Ngăn chặn tình trạng Dual-Write thất thoát sự kiện.
  - [ ] Xây dựng **Hệ Thống Giả Lập Vận Chuyển (Mock Logistics Simulator - Cách 2)**:
    - **Tầng Dịch Vụ Khách Hàng (Storefront Checkout)**: Cho phép khách chọn gói cước *Giao Tiêu Chuẩn (2-4 ngày)* hoặc *Giao Hỏa Tốc (24h)* thay vì phải chọn từng hãng vận chuyển cụ thể.
    - **Bộ Phân Luồng Thông Minh (Smart Routing Logic)**: Backend tự động map gói cước với đối tác phù hợp (Standard $\rightarrow$ GHN/Viettel Post, Express $\rightarrow$ GHTK/AhaMove) và sinh mã vận đơn chuẩn định dạng (VD: `GHN-VN-8492019`).
    - **Cơ Chế Giả Lập Webhook & Timeline (Mock Carrier Webhook & Auto Simulator)**:
      - Endpoint giả lập Webhook từ hãng giao vận (`POST /api/v1/mock/carrier/update-status`) cho phép Dev/Admin mô phỏng các sự kiện: `PICKED_UP` $\rightarrow$ `IN_TRANSIT` $\rightarrow$ `OUT_FOR_DELIVERY` $\rightarrow$ `DELIVERED`.
      - Tự động cập nhật `payment_status = PAID` khi đơn COD được giao thành công (`DELIVERED`).
      - Hỗ trợ chế độ Auto-Timeline Simulator (tự động nhảy trạng thái sau mỗi khoảng thời gian định sẵn để demo/kiểm thử).
    - **Giao Diện Theo Dõi Đơn Hàng (Order Tracking Timeline UI)**: Hiển thị tiến trình đơn hàng trực quan từng bước cho khách hàng trên Storefront.
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
