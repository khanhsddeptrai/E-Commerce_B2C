# Project Agent Guidelines & Constraints

## 1. Quy Tắc Kiểm Thử Trình Duyệt (Browser Testing Rule)
- **Tuyệt đối không tự động mở trình duyệt**: Không tự ý kích hoạt `browser_subagent`, chụp ảnh màn hình hay quay màn hình sau khi chỉnh sửa mã nguồn.
- **Hỏi ý kiến người dùng trước**: Phải hỏi rõ ràng trước khi chạy bất kỳ bài test trình duyệt nào. Chỉ thực hiện khi người dùng đồng ý.

## 2. Quy Tắc Giao Diện (Frontend Design)
- Tuân thủ toàn bộ các quy chuẩn màu sắc, bo góc, bóng đổ và typography trong `docs/04-frontend-design-system.md`.
- Giữ nguyên cấu trúc component JSX, chỉ can thiệp tầng dữ liệu `src/services/productService.ts` khi tích hợp API.
