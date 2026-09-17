# Chuyên Đề 06: Hướng Dẫn Kết Nối Công Cụ Trực Quan (DBeaver, TablePlus...)
**Vị trí:** `docs/troubleshooting/06-gui-and-tools.md`  
**Liên quan:** DBeaver, TablePlus, RedisInsight, RabbitMQ Dashboard

---

## 1. Kết Nối PostgreSQL Bằng DBeaver

DBeaver là công cụ trực quan miễn phí giúp xem, sửa và truy vấn các bảng trong cơ sở dữ liệu `auth_db`.

### Các bước kết nối:
1. Mở phần mềm DBeaver trên máy tính.
2. Nhấn nút **New Database Connection** (Biểu tượng phích cắm điện có dấu cộng ở góc trên bên trái).
3. Chọn loại cơ sở dữ liệu: **PostgreSQL** $\rightarrow$ Nhấn **Next**.
4. Điền các thông số kết nối:
   - **Host:** `localhost`
   - **Port:** `5432`
   - **Database:** `auth_db` *(Lưu ý: Mặc định DBeaver hay điền `postgres`, bạn phải sửa thành `auth_db`)*
   - **Username:** `postgres`
   - **Password:** `postgrespassword`
5. Nhấn nút **Test Connection...**:
   - Nếu DBeaver yêu cầu tải PostgreSQL JDBC Driver, nhấn nút **Download** để ứng dụng tự động tải.
   - Khi hiện thông báo `Connected`, nhấn **Finish**.

### Vị trí các bảng trong DBeaver:
Trong cây thư mục bên trái:
`PostgreSQL - auth_db` $\rightarrow$ `Databases` $\rightarrow$ `auth_db` $\rightarrow$ `Schemas` $\rightarrow$ `public` $\rightarrow$ `Tables`:
- `users`: Bảng chứa danh sách tài khoản người dùng và băm mật khẩu bcrypt.
- `refresh_tokens`: Bảng chứa các token xác thực dài hạn (lưu dạng SHA-256 hash).
- `user_addresses`: Bảng chứa danh sách địa chỉ giao hàng của người dùng.
- `_prisma_migrations`: Bảng theo dõi lịch sử các lần chạy migration của Prisma.

---

## 2. Truy Cập RabbitMQ Management Dashboard

Hệ thống RabbitMQ cung cấp sẵn giao diện web trực quan để giám sát hàng đợi (Queues), thông lượng tin nhắn (Message throughput) và các kết nối.

- **Đường dẫn (URL):** [http://localhost:15672](http://localhost:15672)
- **Tên đăng nhập (Username):** `admin`
- **Mật khẩu (Password):** `admin123`

---

## 3. Kiểm Tra Dữ Liệu Trong Redis (Giỏ Hàng & Khóa Phân Tán)

Bạn có thể sử dụng công cụ **RedisInsight** hoặc dùng lệnh trực tiếp thông qua Docker:

```bash
# Truy cập vào Redis CLI bên trong container
docker exec -it b2c-redis redis-cli

# Xem tất cả các key hiện có
keys *

# Thoát khỏi redis-cli
exit
```

---

## 4. Kiểm Tra Search Engine (Meilisearch)

- **URL:** [http://localhost:7700](http://localhost:7700)
- **Master Key:** `novatech_master_key_123`
- Kiểm tra sức khỏe Meilisearch qua terminal:
  ```bash
  curl http://localhost:7700/health
  # Kết quả mong muốn: {"status":"available"}
  ```
