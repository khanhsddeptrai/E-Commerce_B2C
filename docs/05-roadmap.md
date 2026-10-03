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
  - [x] Thiết lập `product_db`: Tạo bảng Danh mục, Thương hiệu, Sản phẩm và SKU biến thể.
  - [x] Xây dựng **Product Service**: gRPC Microservice (:50052) nạp dữ liệu, danh mục và biến thể SKU.
  - [ ] Tích hợp **Meilisearch Worker**: Lắng nghe sự kiện từ RabbitMQ để đánh chỉ mục (Index) tìm kiếm.
  - [ ] Thiết lập `packages/tailwind-config` & `packages/ui` (Button, Input, ProductCard, Skeleton).
    - *Hiện trạng: chưa tách package dùng chung; component nằm trong `apps/storefront/src/components/`, màu sắc dùng trực tiếp class Tailwind mặc định theo `docs/04`.*
  - [x] Xây dựng **Storefront App (Next.js - apps/storefront)**:
    - [x] Trang chủ NovaTech (Hero Flagship LDAC, Flash Sale đếm ngược, Danh mục).
    - [x] Trang danh mục sản phẩm (Bộ lọc giá/danh mục, tìm kiếm, phân loại).
    - [x] Trang chi tiết sản phẩm (Bộ chọn màu/cấu hình động, bảng thông số kỹ thuật).
    - [x] Giỏ hàng trượt (Cart Drawer) & Trang đặt hàng (Checkout tích hợp API).
    - [x] Nối kết trực tiếp API Gateway BFF (:8000).

---

## Giai Đoạn 3: Giỏ Hàng, Quản Lý Kho & Đơn Hàng (Cart, Inventory & Order)
* **Mục tiêu**: Vận hành giỏ hàng tức thời và cơ chế đặt hàng có bảo vệ tồn kho Flash Sale.
* **Các công việc cụ thể**:
  - [x] Xây dựng **Giỏ hàng trên Redis**: Thêm/sửa/xóa sản phẩm bằng Redis Hash (`cart:{userId}` / `cart:{guestSessionId}`).
  - [x] Viết **Redis Lua Script**: Kiểm tra và giữ kho tức thì (`Hold stock`) nguyên tử với TTL 15 phút.
  - [x] Xây dựng **Order Service** (:50053):
    - [x] Thiết lập `order_db` (Bảng `orders`, `order_items`, `inventory_reservations`, `order_status_history`). *(Giai đoạn 5: giữ hàng chuyển sang `product_db`, bảng `inventory_reservations` của `order_db` đã xóa)*
    - [x] API tạo đơn hàng (Create Checkout) kèm định dạng mã chuẩn `ORD-YYMMDD-XXXX`.
    - [x] Worker định kỳ quét và giải phóng đơn hàng quá hạn 15 phút (`ExpiredOrderWorker`).
    - [x] Quản lý vòng đời trạng thái đơn hàng (Order State Machine: PENDING $\rightarrow$ CONFIRMED / CANCELLED).

---

## Giai Đoạn 4: Thanh Toán, Vận Chuyển & SAGA Orchestration (Payment, Logistics & Consistency)
* **Mục tiêu**: Tích hợp cổng thanh toán trực tuyến, hoàn thiện quy trình giao dịch phân tán an toàn và hệ thống giả lập vận chuyển thông minh.
* **Các công việc cụ thể**:
  - [x] Xây dựng **Payment Service** (:50054):
    - [x] Thiết lập `payment_db` (Bảng `payments`, `payment_logs` lưu trữ toàn bộ audit payload).
    - [x] Tích hợp cổng thanh toán trực tuyến **VNPAY Sandbox** (chuẩn hóa URLSearchParams, IPv4, mã băm HMAC-SHA512 và xác thực thẻ nội địa NCB).
    - [x] Xử lý Idempotency, xác thực Return URL và Webhook/IPN theo chuẩn VNPAY.
  - [x] Hoàn thiện **SAGA Orchestrator giữa Payment Service & Order Service**:
    - *Hiện trạng: SAGA đang chạy bằng **gRPC đồng bộ** (Payment Service gọi trực tiếp `ProcessPaymentSuccess` / `ProcessPaymentFailed` sang Order Service), chưa đi qua RabbitMQ như mô tả trong `docs/01` và `docs/03`.*
    - [x] Thanh toán thành công (`ProcessPaymentSuccess`) $\rightarrow$ Chốt đơn `CONFIRMED`, `paymentStatus = PAID` $\rightarrow$ Chuyển giữ kho từ `HOLD` $\rightarrow$ `COMMITTED` vĩnh viễn.
    - [x] Thanh toán thất bại / Khách hủy giao dịch (`ProcessPaymentFailed`) $\rightarrow$ Kích hoạt bù trừ (Compensating Transaction) tức thì $\rightarrow$ Chuyển đơn `CANCELLED`, nhả tồn kho Redis (`INCRBY stock:{skuId}`) và chuyển giữ kho sang `RELEASED`.
  - [x] Tích hợp luồng thanh toán tại **Storefront**:
    - [x] Tự động sinh liên kết và điều hướng sang VNPAY Sandbox từ trang Checkout.
    - [x] Trang tiếp nhận và đối soát kết quả giao dịch `/checkout/payment-result` với đầy đủ trạng thái Thành công / Thất bại.
  - [ ] Áp dụng **Transactional Outbox Pattern**: Ngăn chặn tình trạng Dual-Write thất thoát sự kiện.
  - [ ] Xây dựng **Hệ Thống Giả Lập Vận Chuyển (Mock Logistics Simulator - Cách 2)** *(đã làm một phần)*:
    - [ ] **Tầng Dịch Vụ Khách Hàng (Storefront Checkout)**: Cho phép khách chọn gói cước *Giao Tiêu Chuẩn (2-4 ngày)* hoặc *Giao Hỏa Tốc (24h)* thay vì phải chọn từng hãng vận chuyển cụ thể.
    - [ ] **Bộ Phân Luồng Thông Minh (Smart Routing Logic)**: Backend tự động map gói cước với đối tác phù hợp (Standard $\rightarrow$ GHN/Viettel Post, Express $\rightarrow$ GHTK/AhaMove) và sinh mã vận đơn chuẩn định dạng (VD: `GHN-VN-8492019`).
      - *Hiện trạng: Admin chọn hãng và sinh mã vận đơn thủ công trên trang `/admin/orders`.*
    - **Cơ Chế Giả Lập Webhook & Timeline (Mock Carrier Webhook & Auto Simulator)**:
      - [x] Endpoint Webhook từ hãng giao vận `POST /api/v1/orders/webhook/carrier` (map `PICKED_UP`/`IN_TRANSIT` $\rightarrow$ `SHIPPING`, `DELIVERED` $\rightarrow$ `DELIVERED`, `FAILED`/`RETURNED` $\rightarrow$ `CANCELLED`) và API Admin `PATCH /api/v1/orders/:id/delivery-status` cập nhật trạng thái kèm hãng vận chuyển, mã vận đơn.
      - [x] Tự động cập nhật `payment_status = PAID` khi đơn COD được giao thành công (`DELIVERED`).
      - [ ] Hỗ trợ chế độ Auto-Timeline Simulator (tự động nhảy trạng thái sau mỗi khoảng thời gian định sẵn để demo/kiểm thử).
    - [x] **Giao Diện Theo Dõi Đơn Hàng (Order Tracking Timeline UI)**: Hiển thị tiến trình đơn hàng trực quan 5 bước cho khách hàng trên Storefront (`/orders/[orderCode]`).
  - [x] Xây dựng **Hệ Thống Xác Thực & Quản Lý Tài Khoản Khách Hàng (Storefront Auth & Account)**:
    - [x] Tầng dịch vụ `authService` và `AuthContext` tích hợp API Gateway (:8000) & JWT Auth Service (:50051).
    - [x] Trang Đăng nhập & Đăng ký tài khoản (`/login`) với tính năng ẩn/hiện mật khẩu, kiểm tra form và tự động quay lại trang trước đó qua tham số `redirect`.
    - [x] Bảo vệ luồng mua sắm: Bắt buộc đăng nhập khi khách bấm thêm vào giỏ hàng, mua ngay hoặc thanh toán.
    - [x] Trang Thông tin tài khoản người dùng (`/account/profile` và `/account`).
    - [x] Menu tài khoản người dùng trên Navbar (Desktop & Mobile Drawer) kèm chức năng đăng xuất an toàn.
    - [x] Trang tra cứu lịch sử đơn hàng của khách hàng trên Storefront (`/account/orders`).

---

## Giai Đoạn 5: Quản Trị Hệ Thống & Quản Lý Kho (Admin Dashboard & WMS)
* **Mục tiêu**: Xây dựng trang quản trị toàn diện cho nhân viên/chủ shop và hệ thống quản lý xuất - nhập - tồn kho thực tế.
* **Các công việc cụ thể**:
  - [x] Xây dựng **Hệ Thống Quản Lý Kho Thực Tế (WMS - Warehouse Management)** *(hoàn thành 2026-10-03 – chi tiết `docs/06-wms-implementation-plan.md`)*:
    - [x] **Cơ sở dữ liệu kho (`product_db`)**: `warehouses` (kho mặc định `HCM-01`), `inventory_stocks` (tồn thực tế `on_hand` / đã chốt `reserved` theo SKU × kho), `inventory_reservations` (giữ hàng theo đơn, chuyển từ `order_db`), `inventory_transactions` (sổ xuất - nhập - tồn `INBOUND` / `OUTBOUND` / `RETURN` / `ADJUSTMENT`), `inventory_receipts` + `inventory_receipt_items` (phiếu nhập `GRN-YYMMDD-XXXX`, giá vốn). Đã xóa cột cũ `product_skus.stock_quantity`.
    - [x] **Tồn kho chỉ do Product Service quản lý** (`InventoryService` gRPC): Order Service không còn ghi `product_db` / Redis; thao tác kho sau khi tạo đơn đi qua `stock_sync_tasks` + `StockSyncWorker` (thử lại đến khi thành công).
    - [x] **Quy trình Nhập kho (Inbound)**: Tạo phiếu nhập $\rightarrow$ tăng `on_hand`, ghi sổ `INBOUND`, tăng số còn bán được trên Redis (`INCRBY stock:{skuId}`).
    - [x] **Quy trình Xuất kho (Outbound & Order Fulfillment)**: Admin bấm *"Xác nhận xuất kho"* (đơn `CONFIRMED` $\rightarrow$ `SHIPPING`) $\rightarrow$ trừ `on_hand` và `reserved`, ghi sổ `OUTBOUND` theo mã đơn.
    - [x] **Quy trình Kiểm kê & Hàng hoàn (Stock Adjustment & Returns)**: Phiếu điều chỉnh kiểm kê (chênh lệch + lý do); giao thất bại $\rightarrow$ *"Nhận hàng hoàn"* (`RETURNED`) nhập lại kho, ghi sổ `RETURN`.
  - [ ] Xây dựng **Admin Dashboard** *(đã làm một phần)*:
    - *Hiện trạng: Admin đang nằm trong `apps/storefront/src/app/admin` (Next.js + Tailwind, chưa dùng Shadcn UI / TanStack Table), chưa tách thành `apps/admin`.*
    - [x] Bảo vệ truy cập theo vai trò (RBAC): chặn người chưa đăng nhập và tài khoản không phải `ADMIN` ở `admin/layout.tsx` lẫn API Gateway.
    - [x] Phân hệ Quản lý Sản phẩm (`/admin/products`): danh sách có lọc/tìm kiếm/phân trang, tạo/sửa sản phẩm kèm biến thể SKU và thông số, đổi trạng thái `PUBLISHED`/`ARCHIVED`, cập nhật tồn kho SKU, tải ảnh sản phẩm.
    - [ ] Quản lý danh mục và thương hiệu (hiện mới có API đọc `GET /categories`, `GET /brands`).
    - [x] Phân hệ Quản lý Kho (`/admin/inventory`): tồn thực tế / đã chốt / đang giữ / còn bán được, điều chỉnh kiểm kê, phiếu nhập kho, sổ xuất nhập tồn có bộ lọc, đối soát Redis.
    - [ ] Xuất file báo cáo xuất - nhập - tồn (Excel / PDF).
    - [x] Phân hệ Quản lý Đơn hàng (`/admin/orders`): danh sách và chi tiết đơn hàng, cập nhật trạng thái vận chuyển kèm hãng và mã vận đơn, trục thời gian lịch sử trạng thái.
    - [x] Duyệt đơn, xác nhận xuất kho, giao thất bại, nhận hàng hoàn, cảnh báo và thử lại đồng bộ kho trên `/admin/orders`.
    - [ ] Công cụ kích hoạt giả lập Webhook vận chuyển (Mock Carrier Trigger) trên giao diện.
    - [ ] Phân trang server cho `/admin/orders` (hiện tải tối đa 50 đơn và lọc phía client).

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
