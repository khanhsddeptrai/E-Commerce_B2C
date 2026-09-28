# Project Agent Guidelines & Constraints

## 1. Quy Tắc Kiểm Thử Trình Duyệt (Browser Testing Rule)
- **Tuyệt đối không tự động mở trình duyệt**: Không tự ý kích hoạt `browser_subagent`, chụp ảnh màn hình hay quay màn hình sau khi chỉnh sửa mã nguồn.
- **Hỏi ý kiến người dùng trước**: Phải hỏi rõ ràng trước khi chạy bất kỳ bài test trình duyệt nào. Chỉ thực hiện khi người dùng đồng ý.

## 2. Quy Tắc Giao Diện (Frontend Design)
- Tuân thủ toàn bộ các quy chuẩn màu sắc, bo góc, bóng đổ và typography trong `docs/04-frontend-design-system.md`.
- Giữ nguyên cấu trúc component JSX, chỉ can thiệp tầng dữ liệu `src/services/productService.ts` khi tích hợp API.
- **Quy chuẩn Tiêu đề (Headings Rule):** Tiêu đề trang / khối (Page/Section Headings) chỉ cần hiển thị nội dung ngắn gọn là đủ (ví dụ: "Quản Lý Đơn Hàng"). Tuyệt đối không thêm các icon trang trí bên trái tiêu đề, không thêm các đoạn mô tả phụ/subtext rườm rà dư thừa bên dưới, và không bọc tiêu đề trong các khung Card/Box thừa thãi.
- **Quy chuẩn Con trỏ chuột (Cursor Pointer):** Toàn bộ các nút bấm (`button`), tab, checkbox và thành phần tương tác phải luôn có con trỏ `cursor-pointer`.

## 3. Quy Chuẩn Kiểu Dữ Liệu (Type Safety)
- **Nghiêm cấm dùng `any` / `as any`:** Trong toàn bộ mã nguồn TypeScript (cả Storefront frontend lẫn các backend microservices), luôn khai báo DTO interface tường minh hoặc sử dụng Prisma Payload types (ví dụ: `ProductPrisma.Prisma...`).
- **Xử lý ngoại lệ:** Dùng `unknown` thay cho `any` trong các khối `catch (err: unknown)` và kiểm tra `err instanceof Error` khi cần lấy thông điệp lỗi.

## 4. Quy Chuẩn Phân Trang API (API Pagination Rule)
- **Bắt buộc phân trang cho toàn bộ API danh sách:** Đối với mọi endpoint / gRPC method trả về dữ liệu dạng danh sách (List / Collection) như sản phẩm, đơn hàng, danh mục, thương hiệu, người dùng, giao dịch,... BẮT BUỘC phải hỗ trợ phân trang (`page`, `limit`) và trả về đầy đủ metadata phân trang trong response.
- **Cấu trúc chuẩn của Response danh sách:**
  ```typescript
  {
    items: T[];       // Hoặc tên cụ thể như products, orders, categories, brands,...
    total: number;    // Tổng số lượng bản ghi thỏa mãn điều kiện lọc trong CSDL
    page: number;     // Trang hiện tại (1-indexed, mặc định 1)
    limit: number;    // Số lượng bản ghi tối đa trên một trang (mặc định 10, 20 hoặc 50)
  }
  ```
- **Nghiêm cấm trả về mảng trần (Raw Array):** Tuyệt đối không trả về mảng thuần `[]` không có metadata phân trang ở bất kỳ API danh sách nào (cả ở tầng gRPC Protobuf, API Gateway REST controller lẫn Storefront API service).
- **Phân trang trên giao diện (Frontend UI):** Bảng dữ liệu quản trị (Data Table) khi hiển thị danh sách phải luôn tích hợp thanh phân trang (Pagination bar) với các chức năng: chọn số dòng trên trang (page size), nút Trang trước/Trang sau/Trang số, và hiển thị rõ "Hiển thị X - Y trên tổng số Z bản ghi".

