# 05. Lộ Trình Triển Khai (Implementation Roadmap & Milestones)

> Tài liệu này vạch ra 6 giai đoạn phát triển chi tiết từ việc thiết lập hạ tầng Monorepo đến khi hệ thống sẵn sàng triển khai thực tế.

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

## Giai Đoạn 5: Quản Trị Hệ Thống & Quản Lý Kho (Admin Dashboard & WMS)
* **Mục tiêu**: Xây dựng trang quản trị toàn diện cho nhân viên/chủ shop và hệ thống quản lý xuất - nhập - tồn kho thực tế.
* **Các công việc cụ thể**:
  - [ ] Xây dựng **Hệ Thống Quản Lý Kho Thực Tế (WMS - Warehouse Management)**:
    - **Cơ sở dữ liệu kho (`product_db`)**:
      - Bổ sung bảng `inventory_receipts` (Phiếu nhập kho từ nhà cung cấp kèm mã phiếu `GRN-XXXX`, giá vốn `cost_price`).
      - Bổ sung bảng `inventory_transactions` (Sổ nhật ký xuất - nhập - tồn: audit trail chi tiết từng SKU, số lượng thay đổi, số dư cuối, loại biến động `INBOUND`, `OUTBOUND`, `ADJUSTMENT`, `RETURN`).
    - **Quy trình Nhập kho (Inbound)**: Tạo phiếu nhập hàng mới $\rightarrow$ cập nhật tồn kho vật lý `product_skus.stock_quantity` $\rightarrow$ tự động tăng tồn khả dụng trên Redis Cache (`INCRBY stock:{skuId}`).
    - **Quy trình Xuất kho (Outbound & Order Fulfillment)**: Thủ kho bấm *"Xác nhận xuất kho đóng gói giao Shipper"* $\rightarrow$ trừ tồn kho vật lý thực tế trong CSDL và ghi nhận giao dịch theo mã đơn hàng.
    - **Quy trình Kiểm kê & Hàng hoàn (Stock Adjustment & Returns)**: Xử lý hàng hư hỏng, xuất hủy hoặc nhập lại kho khi shipper hoàn đơn giao không thành công.
  - [ ] Xây dựng **Admin Dashboard (Next.js + Shadcn UI - `apps/admin`)**:
    - Quản lý sản phẩm, danh mục, thương hiệu, biến thể SKU và thông số kỹ thuật (TanStack Table).
    - Phân hệ Quản lý Kho: Tra cứu tồn thực tế vs tồn bán được, tạo phiếu nhập kho, xuất báo cáo xuất-nhập-tồn.
    - Phân hệ Quản lý Đơn hàng: Xem chi tiết đơn hàng, duyệt đơn, xuất kho và công cụ kích hoạt giả lập Webhook vận chuyển (Mock Carrier Trigger).

---

## Giai Đoạn 6: CSKH Trực Tuyến, Kiểm Thử & Triển Khai (Realtime Chat & Launch Ready)
* **Mục tiêu**: Tích hợp kênh hỗ trợ trực tuyến thời gian thực, hoàn thiện bộ kiểm thử tự động và đóng gói triển khai môi trường Production.
* **Các công việc cụ thể**:
  - [ ] Xây dựng **Notification & Chat Service (`apps/chat-service`)**:
    - Kết nối WebSocket hai chiều với **Socket.io** (`@nestjs/platform-socket.io`).
    - Lưu lịch sử tin nhắn vào **MongoDB** và định tuyến phòng chat theo khách hàng.
    - Gửi email tự động khi đơn hàng thay đổi trạng thái (chờ thanh toán, đang giao, giao thành công).
    - Tích hợp Widget Chat nổi trên Storefront và Cổng tiếp nhận chat CSKH trên Admin Dashboard.
  - [ ] **Kiểm thử Toàn Diện (Testing Suite)**:
    - Viết Unit Tests (Jest) cho nghiệp vụ Core: Redis Lua Script, tính giá đơn hàng, State Machine.
    - Viết E2E Tests (Playwright) cho luồng mua sắm hoàn chỉnh: Duyệt hàng $\rightarrow$ Thêm giỏ $\rightarrow$ Đặt hàng $\rightarrow$ Webhook vận chuyển.
  - [ ] **Tự Động Hóa & Đóng Gói Triển Khai (CI/CD & DevOps)**:
    - Cấu hình CI/CD Pipeline với GitHub Actions (Lint, Typecheck, Build, Test).
    - Viết `docker-compose.apps.yml` và Dockerfile tối ưu (Multi-stage build) khởi chạy trọn gói toàn bộ hệ thống.
