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
