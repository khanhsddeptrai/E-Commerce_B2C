# Chuyên Đề 02: Lỗi Giao Tiếp gRPC, keepCase Protobuf & Exception Filters
**Vị trí:** `docs/troubleshooting/02-grpc-and-protobuf.md`  
**Liên quan:** `packages/proto`, `apps/auth-service`, `apps/api-gateway`

---

## 1. Sự Cố 1: Lỗi Thiếu Trường Dữ Liệu Do Quy Chuẩn Tên (`keepCase`)

### Triệu chứng
- Đăng ký hoặc gửi dữ liệu qua API Gateway báo lỗi: `{ statusCode: 500, message: 'Internal server error' }`.
- Kiểm tra trực tiếp gRPC thấy trả về mã lỗi `2` (`UNKNOWN`).
- Trong database, các trường có dấu gạch dưới (`full_name`, `device_info`, `refresh_token`, `access_token`, `user_id`) bị `undefined` hoặc Prisma ném lỗi thiếu thuộc tính bắt buộc (`NOT NULL`).

### Nguyên nhân kỹ thuật
Thư viện `@grpc/proto-loader` mặc định đặt cờ:
```javascript
keepCase: false // Mặc định tự động chuyển snake_case sang camelCase
```
Vì vậy, định nghĩa trong file `auth.proto` là `full_name` nhưng khi NestJS gRPC nhận dữ liệu thì đối tượng lại có tên là `fullName`. Nếu mã nguồn đọc `data.full_name`, kết quả sẽ là `undefined`.

### Giải pháp xử lý triệt để

#### 1. Luôn khai báo `keepCase: true` tại cấu hình gRPC
- **Tại server ([apps/auth-service/src/main.ts](file:///d:/MyProject/E-Commerce_B2C/apps/auth-service/src/main.ts)):**
  ```typescript
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: AUTH_PACKAGE_NAME,
      protoPath: AUTH_PROTO_PATH,
      url: `${host}:${port}`,
      loader: {
        keepCase: true, // BẮT BUỘC
      },
    },
  });
  ```
- **Tại client ([apps/api-gateway/src/auth/auth.module.ts](file:///d:/MyProject/E-Commerce_B2C/apps/api-gateway/src/auth/auth.module.ts)):**
  ```typescript
  ClientsModule.register([
    {
      name: 'AUTH_PACKAGE',
      transport: Transport.GRPC,
      options: {
        package: AUTH_PACKAGE_NAME,
        protoPath: AUTH_PROTO_PATH,
        url: process.env.AUTH_GRPC_URL || 'localhost:50051',
        loader: {
          keepCase: true, // BẮT BUỘC
        },
      },
    },
  ])
  ```

#### 2. Cơ chế Fallback an toàn trong Service Handler
Trong các file xử lý nghiệp vụ microservice, luôn viết fallback cho cả hai định dạng:
```typescript
const fullName = data.full_name || (data as any).fullName;
const deviceInfo = data.device_info || (data as any).deviceInfo;
const rawToken = data.refresh_token || (data as any).refreshToken;
const accessToken = data.access_token || (data as any).accessToken;
const userId = data.user_id || (data as any).userId;
```

---

## 2. Sự Cố 2: Lỗi Nghiệp Vụ Bị Biến Thành HTTP 500

### Triệu chứng
Khi người dùng nhập sai mật khẩu, tài khoản bị khóa, hoặc đăng ký email trùng lặp, client nhận về mã lỗi `500 Internal server error` thay vì `401 Unauthorized` hay `409 Conflict`.

### Nguyên nhân
- Khi ném `HttpException` (`ConflictException`, `UnauthorizedException`) trong hàm `@GrpcMethod()`, lớp microservices không thể tạo phản hồi HTTP mà chuyển nó thành lỗi gRPC `UNKNOWN` (mã số 2).
- API Gateway khi nhận lỗi gRPC không có bộ lọc tương ứng để biên dịch ngược lại mã HTTP RESTful.

### Giải pháp xử lý chuẩn

#### 1. Dùng `RpcException` kèm status code chuẩn gRPC tại Microservice
```typescript
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

// 1. Trùng lặp dữ liệu (Conflict - 409)
throw new RpcException({
  code: status.ALREADY_EXISTS, // Mã 6
  message: 'Email đã được sử dụng',
});

// 2. Sai mật khẩu hoặc chưa xác thực (Unauthorized - 401)
throw new RpcException({
  code: status.UNAUTHENTICATED, // Mã 16
  message: 'Email hoặc mật khẩu không chính xác',
});

// 3. Tài khoản bị tạm khóa / Không có quyền (Forbidden - 403)
throw new RpcException({
  code: status.PERMISSION_DENIED, // Mã 7
  message: 'Tài khoản đã bị tạm khóa',
});

// 4. Không tìm thấy bản ghi (NotFound - 404)
throw new RpcException({
  code: status.NOT_FOUND, // Mã 5
  message: 'Người dùng không tồn tại',
});
```

#### 2. Đăng ký `GrpcToHttpExceptionFilter` tại API Gateway
File: `apps/api-gateway/src/common/filters/grpc-exception.filter.ts`
```typescript
// Trong main.ts của API Gateway
app.useGlobalFilters(new GrpcToHttpExceptionFilter());
```
Bộ lọc sẽ tự động ánh xạ:
- gRPC `ALREADY_EXISTS (6)` $\rightarrow$ HTTP `409 Conflict`
- gRPC `UNAUTHENTICATED (16)` $\rightarrow$ HTTP `401 Unauthorized`
- gRPC `PERMISSION_DENIED (7)` $\rightarrow$ HTTP `403 Forbidden`
- gRPC `NOT_FOUND (5)` $\rightarrow$ HTTP `404 Not Found`
- gRPC `INVALID_ARGUMENT (3)` $\rightarrow$ HTTP `400 Bad Request`
