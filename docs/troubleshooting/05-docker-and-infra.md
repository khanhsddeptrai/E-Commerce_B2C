# Chuyên Đề 05: Docker Desktop, WSL 2, Network Timeout & Container Health
**Vị trí:** `docs/troubleshooting/05-docker-and-infra.md`  
**Liên quan:** `docker/docker-compose.yml`, Docker Desktop, WSL 2

---

## 1. Sự Cố 1: Docker Daemon Không Kết Nối Được

### Triệu chứng
```text
docker: error during connect: open //./pipe/docker_engine: The system cannot find the file specified.
```

### Nguyên nhân
- Ứng dụng Docker Desktop chưa được bật trên máy tính.
- Hoặc dịch vụ WSL 2 (Windows Subsystem for Linux) chưa được khởi tạo xong.

### Cách xử lý
1. Mở menu Start trên Windows, gõ tìm kiếm **Docker Desktop** và nhấn Enter để khởi chạy.
2. Đợi thanh trạng thái ở góc dưới bên trái của Docker Desktop chuyển sang màu xanh lá cây (**Engine Running**).
3. Nếu Docker Desktop báo lỗi liên quan tới WSL kernel:
   - Mở PowerShell quyền Administrator.
   - Chạy lệnh: `wsl --update`
   - Khởi động lại máy tính nếu được yêu cầu.

---

## 2. Sự Cố 2: Kéo Image Bị Lỗi Mạng Hoặc Handshake Timeout

### Triệu chứng
```text
failed to authorize: failed to fetch oauth token: Post "https://auth.docker.io/token": net/http: TLS handshake timeout
```

### Nguyên nhân
Lệnh `docker compose up -d` kéo đồng thời 5 images dung lượng lớn (MongoDB ~300MB, PostgreSQL ~120MB, RabbitMQ ~100MB, Meilisearch, Redis). Khi mạng Internet chập chờn hoặc có sự cố đường truyền quốc tế, kết nối TLS đến Docker Hub có thể bị quá thời gian chờ (timeout).

### Cách xử lý
1. Chạy lại lệnh compose up ở thư mục gốc:
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```
   *Docker sẽ tự động tiếp tục tải phần dữ liệu còn dang dở.*
2. Nếu 1 image cụ thể vẫn bị lỗi, kéo thủ công riêng lẻ image đó:
   ```bash
   docker pull postgres:16-alpine
   docker pull redis:7-alpine
   docker pull rabbitmq:3-management-alpine
   docker pull mongo:7.0
   docker pull getmeili/meilisearch:v1.6
   ```

---

## 3. Bảng Kiểm Tra Sức Khỏe Toàn Bộ Container

Sau khi khởi động, chạy lệnh:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Đảm bảo cả 5 container đều hiển thị trạng thái `Up`:

| Tên Container | Hình ảnh Docker | Trạng thái mong muốn | Cổng Host tương ứng |
| :--- | :--- | :---: | :--- |
| `b2c-postgres` | `postgres:16-alpine` | `Up (healthy)` | `5432->5432/tcp` |
| `b2c-redis` | `redis:7-alpine` | `Up` | `6379->6379/tcp` |
| `b2c-rabbitmq` | `rabbitmq:3-management-alpine` | `Up` | `5672->5672/tcp, 15672->15672/tcp` |
| `b2c-mongodb` | `mongo:7.0` | `Up` | `27017->27017/tcp` |
| `b2c-meilisearch` | `getmeili/meilisearch:v1.6` | `Up` | `7700->7700/tcp` |

### Các lệnh quản lý tiện ích:
```bash
# Xem log của 1 container (ví dụ postgres):
docker logs b2c-postgres -n 50

# Khởi động lại toàn bộ cụm:
docker compose -f docker/docker-compose.yml restart

# Dừng toàn bộ cụm:
docker compose -f docker/docker-compose.yml down
```
