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

### Bước 0 — Thiết lập Jest & test đặc tả hành vi hiện tại ✅ *(hoàn thành 2026-10-02)*
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

### Bước 2 — Module `inventory` trong Product Service ✅ *(hoàn thành 2026-10-03)*
- Viết RPC ở mục 5 (proto + interface `packages/proto` + controller + service), worker hết hạn, `ReconcileStock`.
- Test Jest cho từng RPC: idempotency (gọi 2 lần), đồng thời, các chuyển trạng thái trong bảng mục 3.
- Đọc tồn trong `getProducts`/`getAdminProducts`/stats chuyển sang `inventory_stocks` + Redis.
- `createProduct` khởi tạo tồn ban đầu bằng giao dịch `INBOUND` (ref `OPENING`); `updateProduct` không còn sửa tồn.
- Chia 3 phần:
  - **2a ✅** *(2026-10-03)* — `inventory.proto` (package `inventory`, `InventoryService` chạy chung cổng :50052) với `GetSkusForOrder`, `HoldStock`, `CommitStock`, `ReleaseStock`, `ShipStock`; Lua giữ hàng nhiều SKU nguyên tử, cộng trả chỉ khi key tồn tại; 32 test gồm tranh chấp đồng thời (đã kiểm chứng test bắt được lỗi khi bỏ điều kiện chống trùng).
  - **2b ✅** *(2026-10-03)* — `CreateReceipt` (mã `GRN-YYMMDD-XXXX`), `AdjustStock` (mã `ADJ-…`, giảm chỉ trong phần còn bán được – kiểm tra nguyên tử trên Redis), `ReceiveReturn` (nhận toàn bộ hoặc một phần); 22 test.
    - *Giai đoạn chuyển đổi: `createProduct` / `updateSkuStock` có 2 chế độ theo việc đã có kho mặc định hay chưa (chưa chạy backfill → giữ hành vi cũ). Khi đã bật WMS: `createProduct` ghi tồn đầu kỳ, `updateSkuStock` ghi phiếu điều chỉnh phần chênh lệch (sửa lỗi #1) và vẫn đồng bộ cột `stock_quantity` cho tới 2c.*
    - *`updateProduct` vốn không sửa SKU / tồn nên không cần đổi.*
  - **2c ✅** *(2026-10-03)* — `GetInventoryStocks` (on_hand / reserved / held / available, lọc hàng sắp hết, SQL thuần vì lọc theo cột tính toán), `GetInventoryTransactions`, `GetReceipts` (đều phân trang `items/total/page/limit`); `ReconcileStock`; `StockMaintenanceWorker` (đối soát Redis lúc khởi động trước khi nhận request + nhả HOLD quá hạn mỗi 30 giây, chỉ khi đã bật WMS); catalog đọc số còn bán được qua `InventoryService.getAvailableStocks`; test khởi tạo `AppModule` bắt lỗi DI. Tổng 12 RPC kho, 93 test product-service.
    - *Còn lại cho Bước 5: bỏ đồng bộ cột `stock_quantity` trong `updateSkuStock` và các nhánh luồng cũ khi xóa cột.*

### Bước 3 — Refactor Order Service
- Bỏ `ProductPrismaClient`, `RESERVE_STOCK_LUA`, `safeRestoreRedisStock`, `ExpiredOrderWorker` phần kho; gọi RPC mới qua gRPC client.
- Áp dụng quy tắc nhất quán ở mục 5.1: `createOrder` gọi kho trước; mọi thao tác kho sau đó đi qua bảng `stock_sync_tasks` (migration `order_db`) + `StockSyncWorker`.
- Trang `/admin/orders` hiển thị cảnh báo cho đơn có task `FAILED` kèm nút "Thử lại".
- Test riêng cho lỗi 8: Product Service không phản hồi khi thanh toán thành công → task `PENDING` → Product Service hoạt động lại → worker hoàn tất, tồn kho đúng; gọi trùng không trừ 2 lần; reservation đã hết hạn khi commit (mục 5.1c).
- Thêm trạng thái đơn hỗ trợ xuất kho/hàng hoàn nếu cần (vd `RETURNED`), cập nhật `order.proto`.
- Gỡ bảng `inventory_reservations` khỏi `order_db` (migration riêng, sau khi backfill đã chạy).
- Test lại toàn luồng: COD, VNPAY thành công/thất bại, hết hạn, hủy, giao thất bại → hàng hoàn.
- **Thiết kế đã chốt (2026-10-03):**

  | Thao tác trên đơn | Trạng thái đơn | Thao tác kho |
  |---|---|---|
  | Tạo đơn VNPAY | → PENDING | `HoldStock` đồng bộ trước khi ghi đơn |
  | Tạo đơn COD | → CONFIRMED | `HoldStock` đồng bộ + task `COMMIT` *(giữ trước rồi chốt: ghi đơn lỗi thì HOLD tự hết hạn, không còn lượt chốt "mồ côi")* |
  | Thanh toán thành công | PENDING → CONFIRMED | task `COMMIT` |
  | Thanh toán thành công khi đơn đã bị hủy do quá hạn | CANCELLED → CONFIRMED | task `COMMIT` (giữ lại hàng; hết hàng → `FAILED` để admin liên hệ / hoàn tiền) |
  | Thanh toán thất bại / khách hủy / quá hạn 15 phút | → CANCELLED | task `RELEASE` |
  | Admin xác nhận đơn chưa thanh toán | PENDING → CONFIRMED | task `COMMIT` (sửa lỗi #4) |
  | Bàn giao shipper / webhook `PICKED_UP` | CONFIRMED → SHIPPING | task `SHIP` |
  | Giao thành công | → DELIVERED | – |
  | Giao thất bại (đang giao) | SHIPPING → CANCELLED | – (hàng chưa về kho – sửa lỗi #5) |
  | Admin xác nhận đã nhận hàng hoàn | CANCELLED (đã giao) / DELIVERED → RETURNED | task `RETURN` |

  - `StockSyncWorker` 30 giây/lần; task cùng đơn chạy tuần tự; mỗi lần xử lý "nhận" task bằng cập nhật có điều kiện (lease) để không chạy trùng; lỗi tạm thời (mất kết nối, timeout) thử lại với backoff 30 giây → tối đa 10 phút, quá 20 lần → `FAILED`; lỗi nghiệp vụ (hết hàng, sai trạng thái) → `FAILED` ngay. Task `FAILED` chặn các task sau của cùng đơn cho tới khi admin bấm thử lại (RPC `RetryStockSync`).
  - `OrderDto` thêm `stock_sync_status` (`OK`/`PENDING`/`FAILED`) + `stock_sync_error`.
  - Chia: **3a** migration + gRPC client + thực thi task + worker; **3b** nối lại các luồng, bỏ code kho cũ; **3c** chuyển đổi trên dữ liệu dev cùng người dùng (tắt service → backup → migrate → backfill → bật service → soát số liệu).
  - **3a ✅** *(2026-10-03)* — Migration `add_stock_sync_tasks` (cột `seq` tự tăng để xếp thứ tự task tạo cùng transaction; chưa áp dụng lên dev, để 3c), gRPC client `InventoryService` (`PRODUCT_GRPC_URL`), `StockSyncService` + `StockSyncWorker`, `OrderDto.stock_sync_status/error`, RPC `RetryStockSync`; 14 test (DB riêng `order_db_ordersvc_test`).
    - *Phát sinh: bỏ `import.meta` trong `getProtoPath` (`packages/proto`) vì Jest không nạp được; thêm đóng kết nối Redis / ProductPrismaClient khi `OrderService` / `ExpiredOrderWorker` tắt (lỗi có sẵn làm Jest không thoát – sẽ bỏ hẳn ở 3b).*
  - **3b ✅** *(2026-10-03)* — `OrderService` viết lại theo bảng thiết kế: tạo đơn lấy giá qua `GetSkusForOrder` + `HoldStock` trước khi ghi đơn (lỗi ghi đơn → nhả hàng), mọi đổi trạng thái dùng cập nhật có điều kiện "đang ở trạng thái cũ" (thao tác đồng thời → `ABORTED`) + task kho cùng transaction; thanh toán thành công khôi phục đơn đã hủy do quá hạn; thanh toán thất bại đến muộn sau khi đã trả tiền bị bỏ qua; trạng thái `RETURNED` (nhận hàng hoàn). `ExpiredOrderWorker` chỉ còn hủy đơn PENDING quá 15 phút + task `RELEASE`. Gỡ hẳn `ProductPrismaClient`, Redis, `RESERVE_STOCK_LUA`, `safeRestoreRedisStock` và phụ thuộc `ioredis` khỏi order-service; đơn mới lưu ghi chú khách vào `orders.note`.
    - *Gateway: `POST /api/v1/orders/:id/retry-stock-sync` (ADMIN); `new_status` chỉ nhận `CONFIRMED/SHIPPING/DELIVERED/CANCELLED/RETURNED`; filter lỗi map thêm `RESOURCE_EXHAUSTED/FAILED_PRECONDITION/ABORTED` → 409, `UNAVAILABLE` → 503, `DEADLINE_EXCEEDED` → 504 (trước đây đều là 500).*
    - *31 test luồng đơn hàng (tổng 45 test order-service); đã kiểm chứng test đồng thời bắt được lỗi khi bỏ điều kiện chống trùng.*
    - ***Từ đây code chỉ chạy đúng sau khi chuyển đổi dữ liệu (3c).***
  - **3c ✅** *(2026-10-03)* — Chuyển đổi trên dữ liệu dev: backup `backups/20261003-1346-before-wms-cutover` → migrate `stock_sync_tasks` → backfill (36 SKU, 2 lượt `COMMITTED` từ 2 đơn CONFIRMED, không cảnh báo) → bật service. Đối chiếu với bảng dự kiến lập trước: 36/36 SKU khớp; tổng `on_hand` 1006 = tồn cũ 1004 + 2 sản phẩm đã chốt chưa xuất; sổ kho tồn đầu kỳ 1006 khớp tổng tồn; `ReconcileStock` trên hệ thống đang chạy: lệch 0. Sửa luôn 3 SKU Redis thấp hơn DB do lỗi #3 (trả lại 4 sản phẩm bị "bán thiếu").
    - *Lưu ý cho Bước 4: client gRPC của NestJS chỉ bật `keepCase` nên trường `repeated` rỗng trả về `undefined` – Gateway phải dùng `?? []` khi đọc các API danh sách kho.*
    - *Kiểm thử end-to-end trên hệ thống dev đang chạy (gateway thật + VNPAY sandbox), SKU `NV-SND-SLV`: đặt COD → bàn giao shipper (sổ kho `OUTBOUND -1`) → giao thành công (COD tự PAID); khách hủy đơn COD đã chốt (trả lại hàng – lỗi #3 đã sửa); đặt quá số còn bán → HTTP 409; VNPAY khách hủy trên trang VNPAY → CANCELLED + nhả hàng; VNPAY thanh toán thành công bằng thẻ test NCB → CONFIRMED + PAID + chốt hàng. Mọi bước khớp số liệu dự kiến, mọi task kho `DONE`, `ReconcileStock` cuối: 36 SKU lệch 0.*
    - *Lỗi có sẵn phát hiện khi kiểm thử: order-service nạp bản `@nestjs/microservices` khác với bản `@nestjs/core` dùng (khác peer `ioredis`) nên `instanceof RpcException` luôn sai → mọi lỗi nghiệp vụ thành "Internal server error" (HTTP 500). Đã sửa bằng `GrpcExceptionFilter` toàn cục (nhận diện theo hình dạng thay vì `instanceof`) đăng ký qua `APP_FILTER`.*

### Bước 4 — API Gateway & giao diện Admin ⏳ *(bước tiếp theo – chi tiết ở mục 8)*
- Endpoint REST cho kho (có phân trang theo quy chuẩn `items/total/page/limit`), chỉ `ADMIN`.
- Trang `/admin/inventory`: tab Tồn kho (thực tế / đã chốt / đang giữ / bán được), tab Phiếu nhập (tạo + danh sách), tab Sổ xuất nhập tồn (lọc SKU, loại, thời gian).
- `/admin/orders`: nút "Xác nhận xuất kho" (đơn `CONFIRMED` → `SHIPPING`) và "Nhận hàng hoàn".
- `/admin/products`: modal sửa nhanh tồn kho → điều chỉnh kiểm kê (nhập chênh lệch + lý do).

### Bước 5 — Tài liệu & dọn dẹp ⏳ *(chi tiết ở mục 8)*
- Cập nhật `docs/02-database-design.md`, `docs/01-system-architecture.md`, `docs/05-roadmap.md`, `CLAUDE.md`.
- Migration dọn dẹp: xóa cột `product_skus.stock_quantity`.

## 7. Rủi Ro & Lưu Ý

- **Migration dữ liệu chạy trên 2 database** (`product_db`, `order_db`): backfill phải chạy khi các service đang dừng; viết script idempotent để chạy lại an toàn.
- **Thứ tự triển khai**: Bước 2 và 3 phải hoàn tất cùng nhau trước khi chạy lại hệ thống, vì nguồn tồn kho thay đổi.
- **Quy trình vận hành mới**: admin phải bấm "Xác nhận xuất kho" trước khi đơn chuyển sang `SHIPPING`; webhook `PICKED_UP` từ hãng vận chuyển sẽ gọi `ShipStock` nếu đơn chưa xuất kho.
- Chọn kho xuất cho đơn: giai đoạn này luôn dùng kho mặc định.
- **Hướng nâng cấp sau — Transactional Outbox + RabbitMQ**: thay `StockSyncWorker` gọi gRPC bằng tiến trình đẩy sự kiện từ `stock_sync_tasks` lên RabbitMQ, Product Service tiêu thụ qua consumer có DLQ. Lợi ích: hai service không cần cùng hoạt động tại một thời điểm. Để thành giai đoạn riêng (gắn với mục Transactional Outbox ở Giai đoạn 4 trong roadmap).
- Payment Service → Order Service (`ProcessPaymentSuccess`/`Failed`) vẫn là gọi gRPC đồng bộ; trường hợp gọi thất bại đã được VNPAY gửi lại IPN và trang kết quả thanh toán gọi lại, nên ngoài phạm vi kế hoạch này.

## 8. Bàn Giao Cho Phiên Làm Việc Tiếp Theo *(cập nhật 2026-10-03)*

> Đọc mục này là đủ để làm tiếp, không cần lịch sử hội thoại cũ. Luồng đặt hàng đầy đủ xem mục 5.1 + bảng "Thiết kế đã chốt" ở Bước 3.

### 8.1. Trạng thái hiện tại
- **Bước 0 → 3 đã xong và đã chuyển đổi dữ liệu dev.** WMS đang bật (kho mặc định `HCM-01`). Backfill **đã chạy** — không chạy lại trên dev trừ khi seed thêm SKU mới (script idempotent theo SKU).
- Tồn kho chỉ do product-service quản lý (`InventoryService`, 12 RPC, package gRPC `inventory`, cổng :50052). Order-service không còn kết nối `product_db` / Redis; mọi thao tác kho sau khi tạo đơn đi qua `stock_sync_tasks` + `StockSyncWorker`.
- Test: product-service 93, order-service 48 (`pnpm turbo run test`, cần Docker). Kiểm thử end-to-end trên hệ thống thật đã pass 7 kịch bản (xem Bước 3c).
- **Việc dở dang:** không có code dở dang. Đầu phiên chạy `git status`; nếu còn thay đổi ở `CLAUDE.md` / file này thì đó là phần bàn giao chưa commit (`docs(wms): thêm hướng dẫn bàn giao cho bước 4 và 5`).
- Dữ liệu test còn lại trên dev: 6 đơn của `admin@novatech.com` có ghi chú "Đơn test tự động WMS"; đơn `ORD-261003-D8Q6` đang CONFIRMED + PAID, giữ (`COMMITTED`) 1 cái `NV-SND-SLV` — dùng được để test nút "Bàn giao shipper" / "Nhận hàng hoàn" ở Bước 4.

### 8.2. Bước 4 — việc cần làm
**a) API Gateway** (`apps/api-gateway`)
- Thêm gRPC client `InventoryService` (package `INVENTORY_PACKAGE_NAME`, `INVENTORY_PROTO_PATH`, url `PRODUCT_GRPC_URL`) — làm giống `catalog.module.ts`.
- Module mới `inventory` với các endpoint (đều `JwtAuthGuard` + kiểm tra `role === 'ADMIN'`):
  - `GET /api/v1/admin/inventory/stocks?page&limit&search&low_stock_only&low_stock_threshold` → `GetInventoryStocks`
  - `GET /api/v1/admin/inventory/transactions?page&limit&sku_id&type&ref_id&from&to` → `GetInventoryTransactions`
  - `GET /api/v1/admin/inventory/receipts?page&limit&search` → `GetReceipts`
  - `POST /api/v1/admin/inventory/receipts` (supplier_name, note, items[{sku_id, quantity, cost_price}]) → `CreateReceipt`, `created_by = ADMIN_<email>`
  - `POST /api/v1/admin/inventory/adjustments` (sku_id, quantity_delta ≠ 0, reason bắt buộc) → `AdjustStock`
  - `POST /api/v1/admin/inventory/reconcile` → `ReconcileStock` (cảnh báo trên UI: chỉ dùng khi ít giao dịch)
- DTO có `class-validator`; **luôn dùng `?? []` / `?? 0`** khi đọc response gRPC (client Nest chỉ bật `keepCase` nên mảng rỗng / số 0 / false bị bỏ khỏi response).
- Đã có sẵn: `POST /api/v1/orders/:id/retry-stock-sync`; `PATCH /api/v1/orders/:id/delivery-status` nhận `new_status` ∈ `CONFIRMED | SHIPPING | DELIVERED | CANCELLED | RETURNED`.

**b) Storefront – tầng dữ liệu**
- Service mới `apps/storefront/src/services/inventoryService.ts` (gọi các endpoint trên, `credentials: 'include'`); kiểu dữ liệu thêm vào `src/types/ecommerce.ts`.
- `ApiOrderDto` (trong `ecommerce.ts`) thêm `stock_sync_status?: 'OK' | 'PENDING' | 'FAILED'`, `stock_sync_error?`; `orderService.ts` thêm `retryStockSync(orderId)`.

**c) Storefront – giao diện admin** (tuân thủ `AGENTS.md`: thanh phân trang đầy đủ "Hiển thị X - Y trên tổng số Z", `cursor-pointer`, tiêu đề ngắn không icon / subtext, design system `docs/04`; tái sử dụng `ResizableDrawer`, `Tooltip`, `Toast`)
- Trang mới `apps/storefront/src/app/admin/inventory/page.tsx`, thêm link vào sidebar `apps/storefront/src/app/admin/layout.tsx` (cạnh `/admin/orders`, `/admin/products`):
  - Tab **Tồn kho**: bảng SKU × kho với on_hand / reserved / held / available, tìm kiếm, lọc "sắp hết hàng", phân trang server; nút "Điều chỉnh" mở drawer nhập chênh lệch + lý do.
  - Tab **Phiếu nhập**: danh sách phiếu (mã GRN, nhà cung cấp, tổng SL, tổng giá vốn, người tạo, thời gian) + drawer tạo phiếu (chọn nhiều SKU, số lượng, giá vốn).
  - Tab **Sổ xuất nhập tồn**: lọc theo SKU / loại (INBOUND, OUTBOUND, RETURN, ADJUSTMENT) / mã chứng từ / khoảng thời gian; số lượng âm-dương có màu.
- `apps/storefront/src/app/admin/orders/page.tsx`:
  - Badge trạng thái đồng bộ kho (PENDING = đang chờ, FAILED = đỏ kèm `stock_sync_error`) + nút **"Thử lại đồng bộ kho"**.
  - Nút **"Nhận hàng hoàn"** (`new_status: 'RETURNED'`) cho đơn DELIVERED, hoặc CANCELLED có `shipped_at`.
  - Thêm trạng thái `RETURNED` vào tab lọc, badge và thống kê; hiển thị thông báo lỗi 409 từ backend (vd chuyển trạng thái không hợp lệ).
- Trang của khách `apps/storefront/src/app/account/orders/page.tsx` và `apps/storefront/src/app/orders/[orderCode]/page.tsx`: hiển thị trạng thái `RETURNED` ("Đã hoàn hàng").
- `apps/storefront/src/app/admin/products/page.tsx`: modal "sửa nhanh tồn kho" hiện đặt **tồn thực tế mới** (backend tự ghi phiếu điều chỉnh, từ chối nếu thấp hơn phần đã giữ/chốt) — đổi nhãn cho rõ, hiển thị lỗi 409; cột tồn trong bảng là **số còn bán được**.
- Theo `AGENTS.md`: **hỏi người dùng trước khi mở trình duyệt để test**.

### 8.3. Bước 5 — việc cần làm
- Tài liệu: `docs/02-database-design.md` (bảng kho mới, `stock_sync_tasks`, bỏ `inventory_reservations` khỏi order_db), `docs/01-system-architecture.md` (InventoryService, luồng đồng bộ kho), `docs/05-roadmap.md` (tick WMS ở Giai đoạn 5).
- Dọn dẹp code luồng cũ trong product-service: nhánh "chưa bật WMS" ở `catalog.service.ts` (`createProduct`, `updateSkuStock`, `resolveSkuStocks`), giá trị `null` của `InventoryService.setOnHand / getAvailableStocks`, test `test.failing` lỗi #1 trong `admin-products.spec.ts`.
- Migration `product_db`: xóa cột `product_skus.stock_quantity`; sửa các file seed (`packages/database/prisma/seed-*.js`) để tạo tồn qua `inventory_stocks` + giao dịch INBOUND tồn đầu kỳ.
- Migration `order_db`: xóa bảng / model `inventory_reservations` cũ; sau đó script `backfill-inventory.js` hết tác dụng (xóa hoặc ghi rõ chỉ dùng cho lịch sử).
- Backup DB trước khi chạy migration xóa cột / bảng.

### 8.4. Lưu ý kỹ thuật đã gặp (tránh lặp lại)
- **Node qua fnm:** shell của agent không có node trên PATH → `fnm exec --using=22 -- pnpm.cmd <lệnh>` (PowerShell) hoặc thêm `/c/Users/LEGION/AppData/Roaming/fnm/node-versions/v22.22.2/installation` vào PATH (Bash).
- **`prisma generate` lỗi EPERM** khi service đang chạy → nhờ người dùng tắt service trước.
- **Prisma chặn lệnh phá dữ liệu khi phát hiện AI agent** (`--force-reset`, `migrate reset`): không lách; test tự tạo lại database `_test` bằng SQL.
- **Git Bash đổi đường dẫn `/tmp`** khi gọi `docker exec` → đặt `MSYS_NO_PATHCONV=1`.
- **Không dùng `python3`** trên máy này (mở Microsoft Store và treo).
- **Không `rm` với đường dẫn tương đối** khi backup tạm — để file tạm trong thư mục scratchpad của phiên.
- **`sed` với ký tự `#` làm phân cách** sẽ hỏng khi nội dung có tiêu đề markdown `###` — dùng Edit thay vì sed cho file markdown.
- **Order-service nạp bản `@nestjs/microservices` khác `@nestjs/core`** → đã xử lý bằng `GrpcExceptionFilter`; khi thêm service mới cần kiểm tra lại (script so sánh `require.resolve` từ code và từ `@nestjs/core`).
- **Gateway giới hạn đăng nhập 5 lần / 60 giây** (HTTP 429) → script test phải dùng lại token.
- **Test end-to-end VNPAY sandbox:** chọn "Thẻ nội địa" → NCB → thẻ test công khai của VNPAY sandbox; hộp thoại "Điều khoản sử dụng" của VNPAY **cần người dùng cho phép** trước khi bấm đồng ý. IPN của VNPAY không gọi được `localhost`, chỉ nhánh trang kết quả (`/checkout/payment-result` → `vnpay-return`) hoạt động trên dev.
- **Kiểm chứng test tranh chấp đồng thời:** tạm bỏ điều kiện chống trùng, xác nhận test fail ổn định (chạy nhiều vòng), rồi khôi phục — đã làm cho mọi RPC kho, `StockSyncService.claim`, `OrderService.transition`.
