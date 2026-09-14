# 02. Thiết Kế Cơ Sở Dữ Liệu (Database Schema Specification)

> Tài liệu này chuẩn hóa toàn bộ các bảng trong 4 cơ sở dữ liệu PostgreSQL (`auth_db`, `product_db`, `order_db`, `payment_db`), cấu trúc NoSQL MongoDB (`chat_db`) và quy chuẩn bộ nhớ đệm Redis.

---

## 1. Tổng Quan Kiến Trúc Dữ Liệu

* **Mô hình**: Database-per-Service (Mỗi service chỉ truy cập database riêng của mình).
* **ORM Backend**: Prisma ORM (TypeScript).
* **Quản lý kết nối**: Sử dụng **PgBouncer** làm connection pooler đặt trước cụm PostgreSQL nhằm tối ưu số lượng connection từ nhiều microservice containers.

---

## 2. `auth_db` (PostgreSQL - Service Auth & User)

### 2.1. Bảng `users` (Thông tin tài khoản & định danh)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, Default `uuid_generate_v4()` | Định danh người dùng |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email đăng nhập |
| `password_hash` | VARCHAR(255) | NOT NULL | Mật khẩu băm (Argon2id hoặc Bcrypt) |
| `full_name` | VARCHAR(150) | NOT NULL | Họ và tên người dùng |
| `phone` | VARCHAR(20) | NULLABLE | Số điện thoại liên hệ |
| `avatar_url` | TEXT | NULLABLE | Ảnh đại diện |
| `role` | ENUM | NOT NULL, Default `CUSTOMER` | Phân quyền: `CUSTOMER`, `ADMIN`, `SUPPORT` |
| `status` | ENUM | NOT NULL, Default `ACTIVE` | Trạng thái: `ACTIVE`, `SUSPENDED`, `PENDING_VERIFY` |
| `created_at` | TIMESTAMP | Default `NOW()` | Thời gian tạo |
| `updated_at` | TIMESTAMP | Default `NOW()` | Thời gian cập nhật |

### 2.2. Bảng `user_addresses` (Sổ địa chỉ nhận hàng)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh địa chỉ |
| `user_id` | UUID | FK -> `users.id` (INDEX), NOT NULL | Thuộc tài khoản nào |
| `receiver_name` | VARCHAR(150) | NOT NULL | Tên người nhận hàng |
| `receiver_phone`| VARCHAR(20) | NOT NULL | SĐT người nhận |
| `province` | VARCHAR(100) | NOT NULL | Tỉnh / Thành phố |
| `district` | VARCHAR(100) | NOT NULL | Quận / Huyện |
| `ward` | VARCHAR(100) | NOT NULL | Phường / Xã |
| `street_address`| VARCHAR(255) | NOT NULL | Tên đường, số nhà |
| `is_default` | BOOLEAN | Default `false` | Có phải địa chỉ mặc định |
| `created_at` | TIMESTAMP | Default `NOW()` | Thời gian tạo |
| `updated_at` | TIMESTAMP | Default `NOW()` | Thời gian cập nhật |

### 2.3. Bảng `refresh_tokens` (Quản lý phiên đăng nhập)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh token |
| `user_id` | UUID | FK -> `users.id` (INDEX), NOT NULL | Thuộc tài khoản nào |
| `token_hash` | VARCHAR(255) | UNIQUE, NOT NULL | Giá trị Refresh Token được hash |
| `device_info` | VARCHAR(255) | NULLABLE | Thiết bị / Trình duyệt đăng nhập |
| `expires_at` | TIMESTAMP | NOT NULL | Thời điểm hết hạn |
| `revoked_at` | TIMESTAMP | NULLABLE | Thời điểm thu hồi (Đăng xuất / Bị hủy) |
| `created_at` | TIMESTAMP | Default `NOW()` | Thời điểm cấp |

---

## 3. `product_db` (PostgreSQL - Service Product & Catalog)

### 3.1. Bảng `categories` (Cây danh mục đa cấp)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh danh mục |
| `parent_id` | UUID | FK -> `categories.id` (NULLABLE) | Danh mục cha (nếu là danh mục con) |
| `name` | VARCHAR(150) | NOT NULL | Tên danh mục (ví dụ: Áo Nam) |
| `slug` | VARCHAR(180) | UNIQUE, NOT NULL | URL thân thiện SEO |
| `description` | TEXT | NULLABLE | Mô tả danh mục |
| `image_url` | TEXT | NULLABLE | Ảnh banner danh mục |
| `display_order` | INT | Default `0` | Thứ tự hiển thị |
| `is_active` | BOOLEAN | Default `true` | Bật/tắt hiển thị |
| `created_at` | TIMESTAMP | Default `NOW()` | Thời gian tạo |
| `updated_at` | TIMESTAMP | Default `NOW()` | Thời gian cập nhật |

### 3.2. Bảng `brands` (Thương hiệu / Nhãn hàng)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh thương hiệu |
| `name` | VARCHAR(150) | NOT NULL | Tên thương hiệu |
| `slug` | VARCHAR(180) | UNIQUE, NOT NULL | URL thân thiện SEO |
| `logo_url` | TEXT | NULLABLE | Ảnh Logo |
| `is_active` | BOOLEAN | Default `true` | Trạng thái hoạt động |

### 3.3. Bảng `products` (Sản phẩm gốc - Parent Product)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh sản phẩm |
| `category_id` | UUID | FK -> `categories.id` (INDEX), NOT NULL | Danh mục chính |
| `brand_id` | UUID | FK -> `brands.id` (NULLABLE) | Thương hiệu sản phẩm |
| `name` | VARCHAR(255) | NOT NULL | Tên sản phẩm |
| `slug` | VARCHAR(280) | UNIQUE, NOT NULL | Đường dẫn URL SEO |
| `short_description`| VARCHAR(500)| NULLABLE | Tóm tắt sản phẩm |
| `description` | TEXT | NOT NULL | Nội dung chi tiết (HTML / Markdown) |
| `thumbnail_url`| TEXT | NOT NULL | Ảnh đại diện chính |
| `base_price` | DECIMAL(15,2)| NOT NULL | Giá gốc hiển thị tham chiếu |
| `status` | ENUM | NOT NULL, Default `DRAFT` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `created_at` | TIMESTAMP | Default `NOW()` | Thời gian tạo |
| `updated_at` | TIMESTAMP | Default `NOW()` | Thời gian cập nhật |

### 3.4. Bảng `product_images` (Bộ sưu tập ảnh sản phẩm)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh ảnh |
| `product_id` | UUID | FK -> `products.id` (INDEX), NOT NULL | Thuộc sản phẩm nào |
| `image_url` | TEXT | NOT NULL | URL ảnh tải lên S3/Cloudinary |
| `display_order`| INT | Default `0` | Thứ tự sắp xếp ảnh |
| `is_thumbnail`| BOOLEAN | Default `false` | Có phải ảnh thumbnail |

### 3.5. Bảng `product_attributes` & `product_attribute_values`
* **`product_attributes`**: `id` (PK, UUID), `product_id` (FK -> `products.id`), `name` (VARCHAR - ví dụ: "Màu sắc", "Kích cỡ").
* **`product_attribute_values`**: `id` (PK, UUID), `attribute_id` (FK -> `product_attributes.id`), `value` (VARCHAR - ví dụ: "Đỏ", "XL").

### 3.6. Bảng `product_skus` (Biến thể sản phẩm - Đơn vị bán thực tế)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh SKU biến thể |
| `product_id` | UUID | FK -> `products.id` (INDEX), NOT NULL | Thuộc sản phẩm nào |
| `sku_code` | VARCHAR(100) | UNIQUE, NOT NULL | Mã SKU (ví dụ: `TSHIRT-RED-XL`) |
| `price` | DECIMAL(15,2)| NOT NULL | Giá bán thực tế hiện tại |
| `original_price`| DECIMAL(15,2)| NULLABLE | Giá niêm yết (dùng hiển thị gạch giá) |
| `stock_quantity`| INT | NOT NULL, Default `0` | Số lượng tồn kho cơ sở tại DB |
| `image_url` | TEXT | NULLABLE | Ảnh riêng của biến thể này |
| `is_active` | BOOLEAN | Default `true` | Bật/tắt SKU |
| `created_at` | TIMESTAMP | Default `NOW()` | Thời gian tạo |
| `updated_at` | TIMESTAMP | Default `NOW()` | Thời gian cập nhật |

### 3.7. Bảng `product_sku_attribute_values` (Junction Table)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `sku_id` | UUID | FK -> `product_skus.id`, PK | Thuộc biến thể nào |
| `attribute_value_id`| UUID | FK -> `product_attribute_values.id`, PK | Thuộc giá trị thuộc tính nào |

### 3.8. Bảng `outbox_events` (Transactional Outbox)
* `id` (UUID, PK), `aggregate_type` (`PRODUCT`), `aggregate_id` (ID), `event_type` (`PRODUCT_CREATED`, `PRODUCT_UPDATED`), `payload` (JSONB), `status` (`PENDING`, `PUBLISHED`, `FAILED`), `retry_count` (INT), `created_at`, `published_at`.

---

## 4. `order_db` (PostgreSQL - Service Order & Inventory)

### 4.1. Bảng `orders` (Thông tin đơn hàng trung tâm)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh đơn hàng |
| `order_code` | VARCHAR(50) | UNIQUE, NOT NULL | Mã đơn hiển thị (ví dụ: `ORD-20260913-8821`) |
| `customer_id` | UUID | NOT NULL (INDEX) | ID khách hàng (từ Auth Service) |
| `customer_name` | VARCHAR(150) | NOT NULL | Tên người nhận hàng |
| `customer_phone`| VARCHAR(20) | NOT NULL | SĐT người nhận |
| `customer_email`| VARCHAR(255) | NOT NULL | Email nhận hoá đơn/thông báo |
| `shipping_address`| JSONB | NOT NULL | Snapshot địa chỉ nhận hàng tại thời điểm đặt |
| `subtotal_amount`| DECIMAL(15,2)| NOT NULL | Tổng tiền hàng chưa giảm giá |
| `discount_amount`| DECIMAL(15,2)| Default `0` | Số tiền được giảm giá qua voucher |
| `shipping_fee` | DECIMAL(15,2)| Default `0` | Phí vận chuyển |
| `total_amount` | DECIMAL(15,2)| NOT NULL | Tổng tiền thực tế cần thanh toán |
| `payment_method`| ENUM | NOT NULL | `COD`, `VNPAY`, `MOMO`, `STRIPE` |
| `payment_status`| ENUM | Default `PENDING` | `PENDING`, `PAID`, `FAILED`, `REFUNDED` |
| `order_status` | ENUM | Default `PENDING` | `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPING`, `DELIVERED`, `CANCELLED`, `RETURNED` |
| `voucher_code` | VARCHAR(50) | NULLABLE | Mã giảm giá đã áp dụng |
| `cancel_reason` | TEXT | NULLABLE | Lý do huỷ đơn |
| `created_at` | TIMESTAMP | Default `NOW()` (INDEX) | Thời điểm đặt hàng |
| `updated_at` | TIMESTAMP | Default `NOW()` | Thời điểm cập nhật |

### 4.2. Bảng `order_items` (Chi tiết các sản phẩm trong đơn)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh dòng sản phẩm |
| `order_id` | UUID | FK -> `orders.id` (INDEX), NOT NULL | Thuộc đơn hàng nào |
| `sku_id` | UUID | NOT NULL | ID SKU biến thể |
| `product_id` | UUID | NOT NULL | ID sản phẩm gốc |
| `product_name` | VARCHAR(255) | NOT NULL | Snapshot tên sản phẩm |
| `sku_name` | VARCHAR(255) | NOT NULL | Snapshot biến thể (ví dụ: "Đỏ / Size XL") |
| `unit_price` | DECIMAL(15,2)| NOT NULL | Đơn giá tại thời điểm mua |
| `quantity` | INT | NOT NULL | Số lượng mua |
| `total_price` | DECIMAL(15,2)| NOT NULL | Thành tiền (`unit_price` * `quantity`) |
| `thumbnail_url`| TEXT | NOT NULL | Snapshot ảnh sản phẩm |

### 4.3. Bảng `order_status_history` (Audit trail lịch sử đơn hàng)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh log |
| `order_id` | UUID | FK -> `orders.id` (INDEX), NOT NULL | Thuộc đơn hàng nào |
| `from_status` | VARCHAR(50) | NOT NULL | Trạng thái trước khi đổi |
| `to_status` | VARCHAR(50) | NOT NULL | Trạng thái sau khi đổi |
| `note` | TEXT | NULLABLE | Ghi chú (ví dụ: Giao hàng thành công) |
| `changed_by` | VARCHAR(100) | NOT NULL | User ID hoặc `SYSTEM` / `PAYMENT_WEBHOOK` |
| `created_at` | TIMESTAMP | Default `NOW()` | Thời gian ghi nhận |

### 4.4. Bảng `inventory_reservations` (Lưu vết giữ hàng SAGA)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh reservation |
| `order_id` | UUID | NOT NULL (INDEX) | Đơn hàng đang giữ kho |
| `sku_id` | UUID | NOT NULL (INDEX) | SKU đang giữ |
| `quantity` | INT | NOT NULL | Số lượng giữ |
| `status` | ENUM | Default `HOLD` | `HOLD`, `COMMITTED`, `RELEASED` |
| `expires_at` | TIMESTAMP | NOT NULL | Hạn tạm giữ (15 phút) |
| `created_at` | TIMESTAMP | Default `NOW()` | Thời điểm tạo |

### 4.5. Bảng `vouchers` & `voucher_usages`
* **`vouchers`**: `id` (PK), `code` (UNIQUE), `discount_type` (`PERCENTAGE`/`FIXED_AMOUNT`), `discount_value`, `min_order_amount`, `max_discount_amount`, `total_usage_limit`, `current_usage_count`, `per_user_limit`, `start_date`, `end_date`, `is_active`.
* **`voucher_usages`**: `id` (PK), `voucher_id` (FK -> `vouchers.id`), `user_id`, `order_id`, `discount_amount`, `used_at`.

---

## 5. `payment_db` (PostgreSQL - Service Payment)

### 5.1. Bảng `payments` (Thông tin giao dịch thanh toán)
| Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Định danh giao dịch |
| `payment_code` | VARCHAR(60) | UNIQUE, NOT NULL | Mã giao dịch nội bộ |
| `order_id` | UUID | NOT NULL (INDEX) | Đơn hàng cần thanh toán |
| `customer_id` | UUID | NOT NULL | Khách hàng thực hiện |
| `provider` | ENUM | NOT NULL | `VNPAY`, `MOMO`, `STRIPE`, `COD` |
| `amount` | DECIMAL(15,2)| NOT NULL | Số tiền thanh toán |
| `currency` | VARCHAR(10) | Default `'VND'` | Đơn vị tiền tệ |
| `status` | ENUM | Default `PENDING` | `PENDING`, `PROCESSING`, `SUCCESS`, `FAILED`, `CANCELLED` |
| `transaction_id`| VARCHAR(255)| NULLABLE | Mã giao dịch từ cổng |
| `idempotency_key`| VARCHAR(255)| UNIQUE, NOT NULL | Khóa chống trùng giao dịch |
| `payment_url` | TEXT | NULLABLE | Link chuyển hướng thanh toán |
| `paid_at` | TIMESTAMP | NULLABLE | Thời điểm thanh toán thành công |
| `created_at` | TIMESTAMP | Default `NOW()` | Thời điểm tạo lệnh |
| `updated_at` | TIMESTAMP | Default `NOW()` | Thời điểm cập nhật |

### 5.2. Bảng `payment_transactions` (Lịch sử Webhook / Callback)
* `id` (UUID, PK), `payment_id` (FK -> `payments.id`), `event_type` (`WEBHOOK_RECEIVED`, `IPN_CALLBACK`), `raw_request` (JSONB), `raw_response` (JSONB), `status`, `created_at`.

### 5.3. Bảng `refunds` (Lịch sử hoàn tiền)
* `id` (UUID, PK), `payment_id` (FK -> `payments.id`), `order_id`, `amount`, `reason`, `status` (`PENDING`, `SUCCESS`, `FAILED`), `provider_refund_id`, `created_at`, `updated_at`.

---

## 6. `chat_db` (MongoDB - Service Notification & Chat)

### 6.1. Collection `conversations`
```json
{
  "_id": "ObjectId",
  "customer_id": "UUID (Khách hàng)",
  "customer_name": "Nguyễn Văn A",
  "customer_avatar": "https://cdn.example.com/avatar.jpg",
  "assigned_admin_id": "UUID (Nhân viên CSKH phụ trách - Nullable)",
  "status": "OPEN", // "OPEN", "IN_PROGRESS", "CLOSED"
  "last_message": {
    "content": "Sản phẩm này còn size L không shop?",
    "sender_id": "UUID",
    "sender_role": "CUSTOMER",
    "created_at": "2026-09-13T22:30:00Z"
  },
  "unread_count_customer": 0,
  "unread_count_admin": 1,
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

### 6.2. Collection `messages`
```json
{
  "_id": "ObjectId",
  "conversation_id": "ObjectId (Ref: conversations._id)",
  "sender_id": "UUID",
  "sender_role": "CUSTOMER", // "CUSTOMER", "ADMIN", "SYSTEM"
  "content": "Mình muốn hỏi về đơn hàng này",
  "message_type": "ORDER_CARD", // "TEXT", "IMAGE", "PRODUCT_CARD", "ORDER_CARD"
  "attachments": ["https://cdn.example.com/img1.jpg"],
  "metadata": {
    "order_code": "ORD-20260913-8821",
    "total_amount": 450000
  },
  "status": "SEEN", // "SENT", "DELIVERED", "SEEN"
  "created_at": "ISODate"
}
```

---

## 7. Quy Chuẩn Bộ Nhớ Đệm Redis

| Key Pattern | Cấu Trúc | TTL | Mô Tả Nghiệp Vụ |
| :--- | :--- | :--- | :--- |
| `cart:{customer_id}` | **Hash** | 30 ngày | Lưu giỏ hàng tạm thời dạng `{ [sku_id]: { qty, price, added_at } }` |
| `stock:{sku_id}` | **String / Int** | Không TTL | Tồn kho tức thì phục vụ kiểm tra và trừ tồn Atomic |
| `lock:stock:{sku_id}` | **String** | 5 giây | Khóa phân tán (Redlock) khi thực hiện đồng bộ tồn kho |
| `voucher:{code}:count`| **Integer** | Theo hạn | Đếm lượt dùng mã giảm giá nguyên tử |
| `rate_limit:{ip}:{path}`| **Integer** | 60 giây | Đếm số request để chặn DDoS / Spam API tại Gateway |
