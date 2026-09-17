# Chuyên Đề 01: Xung Đột Cổng Mạng (EADDRINUSE) & Quản Lý Tiến Trình
**Vị trí:** `docs/troubleshooting/01-ports-and-processes.md`  
**Liên quan:** `apps/auth-service`, `apps/api-gateway`, `docker-compose`

---

## 1. Dấu Hiệu Nhận Biết

Khi khởi động dịch vụ qua terminal (`pnpm dev` hoặc `nest start`), hệ thống báo lỗi dừng tiến trình:

```text
Error: No address added out of total 1 resolved errors: [listen EADDRINUSE: address already in use 0.0.0.0:50051]
```
hoặc:
```text
Error: listen EADDRINUSE: address already in use :::8000
```

---

## 2. Bảng Phân Bổ Cổng Trong Hệ Thống

| Dịch vụ / Container | Giao thức | Cổng Host (Windows) | Ghi chú |
| :--- | :---: | :---: | :--- |
| **API Gateway** | REST / HTTP | `8000` | Cửa ngõ trung gian cho Storefront & Admin |
| **Auth Service** | gRPC | `50051` | Quản lý định danh, người dùng & JWT |
| **Product Service** | gRPC | `50052` | Quản lý danh mục & sản phẩm |
| **Order Service** | gRPC | `50053` | Đơn hàng, giỏ hàng & kho hàng |
| **Payment Service** | gRPC | `50054` | Cổng thanh toán & hoàn tiền |
| **PostgreSQL** | TCP | `5432` | Container `b2c-postgres` |
| **Redis** | TCP | `6379` | Container `b2c-redis` |
| **RabbitMQ Core** | AMQP | `5672` | Container `b2c-rabbitmq` |
| **RabbitMQ Dashboard**| HTTP | `15672` | Trang quản trị RabbitMQ Management |
| **MongoDB** | TCP | `27017` | Container `b2c-mongodb` |
| **Meilisearch** | HTTP | `7700` | Container `b2c-meilisearch` |

---

## 3. Nguyên Nhân Cốt Lõi

1. **Tiến trình Node.js chạy ngầm:** Khi đóng tab terminal trong VS Code hoặc IDE mà không nhấn `Ctrl + C`, tiến trình Node.js con vẫn có thể tiếp tục chạy ngầm trong Windows.
2. **Crash không giải phóng socket:** Một ngoại lệ không bắt được làm ứng dụng dừng nhưng socket OS chưa kịp thu hồi kịp thời.

---

## 4. Quy Trình Khắc Phục Chuẩn (Windows PowerShell)

### Bước 1: Tra cứu mã PID của tiến trình chiếm cổng
Chạy lệnh kiểm tra các cổng microservice:
```powershell
netstat -ano | findstr "50051 8000"
```
Kết quả hiển thị ví dụ:
```text
  TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING       28616
  TCP    0.0.0.0:50051          0.0.0.0:0              LISTENING       26984
```
*Cột ngoài cùng bên phải (`28616`, `26984`) chính là mã PID của tiến trình cần dừng.*

### Bước 2: Tắt tiến trình cưỡng bức
Sử dụng công cụ `taskkill` với quyền hiện tại:
```powershell
# Tắt 1 tiến trình:
taskkill /F /PID 28616

# Hoặc tắt nhiều tiến trình cùng lúc:
taskkill /F /PID 28616 /PID 26984
```

### Bước 3: Xác nhận cổng đã được giải phóng
Chạy lại lệnh kiểm tra:
```powershell
netstat -ano | findstr "50051 8000"
```
*Nếu không còn kết quả nào ở trạng thái `LISTENING`, bạn có thể khởi động lại service an toàn.*
