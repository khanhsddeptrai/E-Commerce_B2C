# 06. Kế Hoạch Triển Khai Quản Lý Kho (WMS Implementation Plan)

> Kế hoạch chi tiết cho Giai đoạn 5 – phân hệ Quản lý kho, đồng thời gom toàn bộ logic tồn kho về Product Service để xử lý các lỗi lệch tồn hiện có.
> Trạng thái: **Chờ duyệt** · Tạo ngày 2026-10-02

---

## 1. Các Quyết Định Đã Chốt

| # | Quyết định | Lựa chọn |
|---|---|---|
| 1 | Nơi lưu tồn kho | **Bảng kho riêng trong `product_db`** (phương án B), có hỗ trợ nhiều kho (`warehouses`) |
| 2 | Thời điểm trừ tồn vật lý | **Lúc xuất kho** (admin bấm "Xác nhận xuất kho"), không phải lúc chốt đơn |
| 3 | Bảng giữ hàng `inventory_reservations` | **Chuyển từ `order_db` sang `product_db`** |
| 4 | Kiểm thử | **Viết Jest cho mảng tồn kho trước** khi refactor |

## 2. Hiện Trạng & Các Lỗi Cần Xử Lý

Tồn kho hiện nằm ở 3 nơi: `product_skus.stock_quantity` (bị trừ lúc chốt đơn), Redis `stock:{skuId}` (còn bán được) và `order_db.inventory_reservations`. Cả `product-service` và `order-service` đều ghi trực tiếp vào cột tồn và key Redis.

| # | Lỗi | Vị trí | Hậu quả |
|---|---|---|---|
| 1 | Admin sửa tồn ghi đè Redis bằng số trong DB | `product-service/.../catalog.service.ts` (`updateSkuStock`) | Cộng nhầm phần đang HOLD → bán vượt |
| 2 | `safeRestoreRedisStock` dùng GET rồi SET (không nguyên tử) | `order.service.ts`, `expired-order.worker.ts` | Ghi đè lượt trừ đồng thời → bán vượt |
| 3 | Hủy đơn COD không hoàn Redis | `order.service.ts` (`cancelOrder`) | Mất tồn bán được |
| 4 | Admin chuyển CONFIRMED thủ công không trừ tồn DB | `order.service.ts` (`updateDeliveryStatus`) | DB báo tồn cao hơn thực tế |
| 5 | Hủy khi đang giao: hoàn Redis nhưng không hoàn DB, hàng chưa về kho | `order.service.ts` (`updateDeliveryStatus`) | Lệch Redis/DB, bán hàng chưa về |
| 6 | Trừ tồn DB chạy sau transaction tạo đơn, từng SKU, không retry | `order.service.ts` (`createOrder`, `processPaymentSuccess`) | Đơn tạo nhưng không trừ tồn |
| 7 | Order Service kết nối thẳng `product_db` | `order.service.ts`, `expired-order.worker.ts` | Phá ranh giới microservice |
| 8 | *(phát sinh khi sửa lỗi 7)* Gọi RPC kho giữa Order và Product Service thất bại giữa chừng | Mọi luồng thay đổi trạng thái đơn | Đơn đã đổi trạng thái nhưng kho không được cập nhật → lệch tồn, bán vượt |

## 3. Mô Hình Tồn Kho Mới

```
on_hand    tồn vật lý trong kho     — chỉ đổi khi: nhập kho, xuất kho, nhận hàng hoàn, kiểm kê
reserved   đã chốt đơn, chưa xuất   — tăng khi chốt đơn, giảm khi xuất kho / hủy trước khi xuất
held       đang giữ chờ thanh toán  — tổng các reservation HOLD chưa nhả (kể cả đã quá hạn nhưng worker chưa xử lý)
available  = on_hand − reserved − held   → cache Redis stock:{skuId} (tổng mọi kho)
```

Vòng đời một đơn hàng:

| Sự kiện | on_hand | reserved | held | Sổ kho |
|---|---|---|---|---|
| Đặt đơn VNPAY | – | – | +q | – |
| Thanh toán thành công / Admin xác nhận | – | +q | −q | – |
| Đặt đơn COD | – | +q | – | – |
| Hết hạn / thanh toán thất bại / hủy trước khi chốt | – | – | −q | – |
| Hủy đơn đã chốt, chưa xuất | – | −q | – | – |
| Xác nhận xuất kho | −q | −q | – | `OUTBOUND` |
| Nhận lại hàng hoàn | +q | – | – | `RETURN` |
| Nhập kho theo phiếu | +q | – | – | `INBOUND` |
| Kiểm kê điều chỉnh | ±q | – | – | `ADJUSTMENT` |

## 4. Thiết Kế Dữ Liệu (`product_db`)

- `warehouses`: `code` (vd `HCM-01`), `name`, `is_active`. Seed 1 kho mặc định.
- `inventory_stocks`: `(sku_id, warehouse_id)` unique, `on_hand`, `reserved`, `version` (optimistic locking).
- `inventory_reservations` (chuyển từ `order_db`): `order_id`, `order_code`, `sku_id`, `warehouse_id`, `quantity`, `status` (`HOLD`/`COMMITTED`/`RELEASED`/`SHIPPED`), `expires_at`.
- `inventory_transactions` (chỉ thêm, không sửa): `sku_id`, `warehouse_id`, `type` (`INBOUND`/`OUTBOUND`/`RETURN`/`ADJUSTMENT`), `quantity` (±), `balance_after`, `ref_type` (`RECEIPT`/`ORDER`/`ADJUSTMENT`), `ref_id`, `note`, `created_by`, `created_at`. Unique `(ref_type, ref_id, type, sku_id)` để chống ghi trùng khi retry.
- `inventory_receipts` (`code` `GRN-YYMMDD-XXXX`, `warehouse_id`, `supplier_name`, `note`, `created_by`) + `inventory_receipt_items` (`sku_id`, `quantity`, `cost_price`).
- `product_skus.stock_quantity`: ngừng sử dụng sau migration, xóa ở migration dọn dẹp cuối.

## 5. RPC Kho Mới (Product Service)

| RPC | Gọi bởi | Tác động |
|---|---|---|
| `GetSkusForOrder` | Order (tạo đơn) | Đọc giá, tên, trạng thái SKU |
| `HoldStock` | Order (tạo đơn VNPAY) | 1 Lua script giữ **mọi SKU nguyên tử**; tạo reservation `HOLD` |
| `CommitStock` | Order (thanh toán OK, COD, admin xác nhận) | `HOLD → COMMITTED` (hoặc tạo mới cho COD), `reserved += q` |
| `ReleaseStock` | Order (thất bại, hủy) + worker hết hạn | `HOLD/COMMITTED → RELEASED`, hoàn Redis bằng `INCRBY` |
| `ShipStock` | Order (admin xác nhận xuất kho) | `on_hand −= q`, `reserved −= q`, ghi `OUTBOUND` |
| `ReceiveReturn` | Order (admin nhận hàng hoàn) | `on_hand += q`, ghi `RETURN`, hoàn Redis |
| `AdjustStock` | Gateway (admin kiểm kê) | `on_hand ±= q`, ghi `ADJUSTMENT` |
| `CreateReceipt` / `GetReceipts` | Gateway (admin) | Tạo phiếu nhập → `INBOUND`; danh sách có phân trang |
| `GetInventoryStocks` / `GetInventoryTransactions` | Gateway (admin) | Danh sách có phân trang + bộ lọc |
| `ReconcileStock` | Gateway (admin) / khởi động service | Tính lại Redis = `on_hand − reserved − held` |

Mọi RPC thay đổi tồn đều **idempotent** theo `order_id`/`ref_id`. Worker quét reservation hết hạn chuyển từ Order Service sang Product Service.

### 5.1. Đảm bảo nhất quán giữa Order Service và Product Service (xử lý lỗi 8)

Idempotency chỉ đảm bảo *gọi lại thì an toàn*; cần thêm cơ chế đảm bảo *chắc chắn sẽ được gọi lại* khi lần đầu thất bại. Có hai loại thao tác với hai quy tắc khác nhau:

**a) Giữ hàng lúc tạo đơn (`HoldStock`, và `CommitStock` cho đơn COD) — gọi kho trước, ghi đơn sau**
- Cần câu trả lời ngay "còn hàng hay không" để báo cho khách, nên gọi đồng bộ *trước* khi tạo đơn. Order Service sinh sẵn `order_id`/`order_code` để truyền vào RPC.
- RPC thất bại hoặc hết hàng → không tạo đơn, báo lỗi cho khách.
- RPC thành công nhưng ghi đơn vào `order_db` thất bại → gọi `ReleaseStock` để bù trừ. Nếu bù trừ cũng thất bại: reservation `HOLD` tự hết hạn sau 15 phút; với đơn COD, `ReconcileStock` phát hiện reservation `COMMITTED` không có đơn tương ứng (Product Service hỏi lại Order Service qua `GetOrderById`).

**b) Các thao tác sau khi đơn đã tồn tại (`CommitStock` khi thanh toán, `ReleaseStock`, `ShipStock`, `ReceiveReturn`) — ghi ý định trước, gọi kho sau, thử lại đến khi thành công**
- Bảng mới `stock_sync_tasks` trong `order_db`: `id`, `order_id`, `action` (`COMMIT`/`RELEASE`/`SHIP`/`RETURN`), `status` (`PENDING`/`DONE`/`FAILED`), `attempts`, `next_retry_at`, `last_error`, `created_at`.
- Đổi trạng thái đơn và tạo task `PENDING` trong **cùng một transaction** `order_db` → không thể có chuyện đơn đổi trạng thái mà mất thao tác kho.
- Sau khi commit transaction, gọi RPC ngay; thành công → task `DONE`.
- `StockSyncWorker` (Order Service, mỗi 30 giây) quét task `PENDING` đến hạn, gọi lại RPC với backoff tăng dần (30s → 1 phút → 2 phút → … tối đa 10 phút); quá 20 lần → `FAILED` và hiển thị cảnh báo trên trang admin đơn hàng để xử lý thủ công.
- Task của cùng một đơn được xử lý tuần tự theo `created_at` (không gọi `SHIP` trước khi `COMMIT` xong).

**c) Trường hợp biên: `CommitStock` đến sau khi reservation đã hết hạn và bị nhả**
- Ví dụ Product Service ngừng hoạt động hơn 15 phút đúng lúc khách thanh toán xong.
- `CommitStock` thử giữ lại từ tồn còn bán được; còn đủ → chốt bình thường; không đủ → trả `FAILED_PRECONDITION`, task chuyển `FAILED`, admin thấy cảnh báo "Đơn đã thanh toán nhưng hết hàng" để liên hệ khách / hoàn tiền.

> Bảng `stock_sync_tasks` chính là dạng đơn giản của **Transactional Outbox** (`docs/03`): cùng nguyên tắc ghi ý định chung transaction, chỉ khác là worker gọi gRPC trực tiếp thay vì đẩy lên RabbitMQ. Khi nâng cấp lên RabbitMQ (xem mục 7) chỉ cần thay worker, giữ nguyên bảng và các RPC idempotent.

## 6. Các Bước Triển Khai

Mỗi bước: typecheck + test pass → gửi commit message → người dùng commit → bước tiếp theo.

### Bước 0 — Thiết lập Jest & test đặc tả hành vi hiện tại
- Cài `jest`, `ts-jest`, `@types/jest` cho `product-service` và `order-service`; thêm script `test` và task `test` trong `turbo.json`.
- Test tích hợp chạy với Postgres/Redis từ Docker: dùng database `product_db_test` riêng và Redis DB số 15 để không đụng dữ liệu dev.
- Test Lua giữ kho hiện tại: đủ hàng, thiếu hàng, 2 yêu cầu đồng thời tranh SKU cuối cùng.

### Bước 0.5 — Tách thư mục migrations theo từng database ✅ *(hoàn thành 2026-10-02)*
- *Kết quả: baseline `0_init` sinh từ trạng thái thực tế của từng DB; `order_db` khôi phục cột `orders.note` (bị xóa nhầm khỏi schema ở commit `abd1902`, còn 24 ghi chú của khách) và thêm migration đặt `shipping_method` NOT NULL. Cả 4 DB dev `up to date`, không lệch schema; migrations của cả 4 schema dựng được database mới từ đầu.*
- **Vấn đề (phát hiện ở Bước 0):** 4 schema dùng chung `packages/database/prisma/migrations`; mỗi migration mới chứa `DROP TABLE` bảng của schema khác (`init_product_tables` xóa bảng auth, `init_order_db` xóa bảng product, `init_payment_db` xóa bảng order). Chạy `db:product:migrate` lúc này sẽ áp dụng `init_order_db` lên `product_db` và **xóa toàn bộ bảng sản phẩm**; không dựng lại được database từ đầu.
- Backup 4 database bằng `pg_dump` trước khi làm.
- Chuyển mỗi schema vào thư mục riêng `prisma/{auth,product,order,payment}/schema.prisma`, mỗi thư mục có `migrations/` riêng; sửa đường dẫn `output` của generator.
- Tạo migration nền `0_init` cho mỗi schema bằng `prisma migrate diff --from-empty`.
- Với từng database dev: kiểm tra không lệch schema (`migrate diff --from-url`), xóa lịch sử cũ trong `_prisma_migrations`, `migrate resolve --applied 0_init`. Không đụng dữ liệu bảng nghiệp vụ.
- Cập nhật script `db:*` trong `packages/database/package.json`, `docs/troubleshooting/03-env-and-database.md`; test chuyển sang `migrate deploy`.

### Bước 1 — Schema & migration `product_db` ✅ *(hoàn thành 2026-10-02)*
- Thêm các model ở mục 4 vào `prisma/product/schema.prisma`, tạo migration bằng `db:product:migrate`.
- Script backfill (`prisma/backfill-inventory.js`): tạo kho `HCM-01`; với mỗi SKU tạo `inventory_stocks` từ `stock_quantity` hiện tại + số lượng các đơn đang `CONFIRMED` (đã trừ nhưng chưa xuất); chép reservation `HOLD`/`COMMITTED` còn hiệu lực từ `order_db`; dựng lại Redis.
- Cập nhật các file seed sản phẩm để tạo tồn qua `inventory_stocks`.
- *Kết quả:*
  - *Migration `add_inventory_tables` (chỉ thêm mới) kèm ràng buộc `CHECK` chống tồn âm ở tầng database; đã áp dụng lên `product_db` dev, các bảng kho đang trống.*
  - *Script đặt tại `packages/database/prisma/backfill-inventory.js` (`pnpm --filter @repo/database db:inventory:backfill`), idempotent theo từng SKU. Xử lý thêm trường hợp đơn VNPAY được admin xác nhận khi chưa thanh toán (lỗi #4: tồn cũ chưa bị trừ nên không cộng lại).*
  - *Không sửa file seed: seed vẫn ghi `stock_quantity`, sau đó chạy backfill để khởi tạo tồn cho SKU mới. Seed sẽ chuyển hẳn sang `inventory_stocks` khi xóa cột `stock_quantity` ở Bước 5.*
  - ***Chưa chạy backfill trên dữ liệu dev** — chỉ chạy lúc chuyển đổi, sau khi Bước 2 + 3 hoàn tất và các service đã dừng (nếu chạy sớm, đơn hàng mới phát sinh theo luồng cũ sẽ làm số liệu lệch).*

### Bước 2 — Module `inventory` trong Product Service
- Viết RPC ở mục 5 (proto + interface `packages/proto` + controller + service), worker hết hạn, `ReconcileStock`.
- Test Jest cho từng RPC: idempotency (gọi 2 lần), đồng thời, các chuyển trạng thái trong bảng mục 3.
- Đọc tồn trong `getProducts`/`getAdminProducts`/stats chuyển sang `inventory_stocks` + Redis.
- `createProduct` khởi tạo tồn ban đầu bằng giao dịch `INBOUND` (ref `OPENING`); `updateProduct` không còn sửa tồn.
- Chia 3 phần:
  - **2a ✅** *(2026-10-03)* — `inventory.proto` (package `inventory`, `InventoryService` chạy chung cổng :50052) với `GetSkusForOrder`, `HoldStock`, `CommitStock`, `ReleaseStock`, `ShipStock`; Lua giữ hàng nhiều SKU nguyên tử, cộng trả chỉ khi key tồn tại; 32 test gồm tranh chấp đồng thời (đã kiểm chứng test bắt được lỗi khi bỏ điều kiện chống trùng).
  - **2b** — Nhập kho (phiếu nhập), điều chỉnh kiểm kê, nhận hàng hoàn; `createProduct`/`updateProduct`/`updateSkuStock` chuyển sang mô hình mới.
  - **2c** — API đọc tồn / sổ kho có phân trang, worker nhả giữ hàng hết hạn, `ReconcileStock`; catalog đọc tồn từ `inventory_stocks`.

### Bước 3 — Refactor Order Service
- Bỏ `ProductPrismaClient`, `RESERVE_STOCK_LUA`, `safeRestoreRedisStock`, `ExpiredOrderWorker` phần kho; gọi RPC mới qua gRPC client.
- Áp dụng quy tắc nhất quán ở mục 5.1: `createOrder` gọi kho trước; mọi thao tác kho sau đó đi qua bảng `stock_sync_tasks` (migration `order_db`) + `StockSyncWorker`.
- Trang `/admin/orders` hiển thị cảnh báo cho đơn có task `FAILED` kèm nút "Thử lại".
- Test riêng cho lỗi 8: Product Service không phản hồi khi thanh toán thành công → task `PENDING` → Product Service hoạt động lại → worker hoàn tất, tồn kho đúng; gọi trùng không trừ 2 lần; reservation đã hết hạn khi commit (mục 5.1c).
- Thêm trạng thái đơn hỗ trợ xuất kho/hàng hoàn nếu cần (vd `RETURNED`), cập nhật `order.proto`.
- Gỡ bảng `inventory_reservations` khỏi `order_db` (migration riêng, sau khi backfill đã chạy).
- Test lại toàn luồng: COD, VNPAY thành công/thất bại, hết hạn, hủy, giao thất bại → hàng hoàn.

### Bước 4 — API Gateway & giao diện Admin
- Endpoint REST cho kho (có phân trang theo quy chuẩn `items/total/page/limit`), chỉ `ADMIN`.
- Trang `/admin/inventory`: tab Tồn kho (thực tế / đã chốt / đang giữ / bán được), tab Phiếu nhập (tạo + danh sách), tab Sổ xuất nhập tồn (lọc SKU, loại, thời gian).
- `/admin/orders`: nút "Xác nhận xuất kho" (đơn `CONFIRMED` → `SHIPPING`) và "Nhận hàng hoàn".
- `/admin/products`: modal sửa nhanh tồn kho → điều chỉnh kiểm kê (nhập chênh lệch + lý do).

### Bước 5 — Tài liệu
- Cập nhật `docs/02-database-design.md`, `docs/01-system-architecture.md`, `docs/05-roadmap.md`, `CLAUDE.md`.
- Migration dọn dẹp: xóa cột `product_skus.stock_quantity`.

## 7. Rủi Ro & Lưu Ý

- **Migration dữ liệu chạy trên 2 database** (`product_db`, `order_db`): backfill phải chạy khi các service đang dừng; viết script idempotent để chạy lại an toàn.
- **Thứ tự triển khai**: Bước 2 và 3 phải hoàn tất cùng nhau trước khi chạy lại hệ thống, vì nguồn tồn kho thay đổi.
- **Quy trình vận hành mới**: admin phải bấm "Xác nhận xuất kho" trước khi đơn chuyển sang `SHIPPING`; webhook `PICKED_UP` từ hãng vận chuyển sẽ gọi `ShipStock` nếu đơn chưa xuất kho.
- Chọn kho xuất cho đơn: giai đoạn này luôn dùng kho mặc định.
- **Hướng nâng cấp sau — Transactional Outbox + RabbitMQ**: thay `StockSyncWorker` gọi gRPC bằng tiến trình đẩy sự kiện từ `stock_sync_tasks` lên RabbitMQ, Product Service tiêu thụ qua consumer có DLQ. Lợi ích: hai service không cần cùng hoạt động tại một thời điểm. Để thành giai đoạn riêng (gắn với mục Transactional Outbox ở Giai đoạn 4 trong roadmap).
- Payment Service → Order Service (`ProcessPaymentSuccess`/`Failed`) vẫn là gọi gRPC đồng bộ; trường hợp gọi thất bại đã được VNPAY gửi lại IPN và trang kết quả thanh toán gọi lại, nên ngoài phạm vi kế hoạch này.
