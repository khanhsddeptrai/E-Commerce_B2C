---
name: conventional-commit
description: 'Phân tích thay đổi git và sinh thông điệp commit chuẩn Conventional Commits bằng Tiếng Việt gồm Summary và Description để người dùng tự xem xét và commit.'
---

### Mục đích
Skill này hướng dẫn Agent phân tích các thay đổi trong kho mã nguồn (`git status`, `git diff`) và sinh ra nội dung commit gồm **Summary** và **Description** rõ ràng, chuẩn quy ước **Conventional Commits** bằng **TIẾNG VIỆT**.

> [!IMPORTANT]
> **Quy tắc bắt buộc:**
> 1. **Ngôn ngữ viết commit:** Toàn bộ phần mô tả trong **Summary** và **Description** phải viết bằng **TIẾNG VIỆT** (dùng từ ngữ kỹ thuật quen thuộc, bắt đầu bằng động từ hành động: *thêm, sửa, cập nhật, cấu hình, tối ưu...*). Tiền tố `<type>` và `<scope>` giữ theo chuẩn tiếng Anh Conventional Commits.
> 2. **Chỉ in ra nội dung:** Chỉ hiển thị Summary và Description trong khung chat để người dùng copy.
> 3. **TUYỆT ĐỐI KHÔNG tự chạy commit/push:** Người dùng sẽ tự kiểm tra, chỉnh sửa (nếu cần) và tự thực hiện commit/push trên GitHub Desktop hoặc Terminal.

---

### Quy trình thực hiện (Workflow)
1. Kiểm tra danh sách file thay đổi bằng `git status -s`.
2. Kiểm tra chi tiết nội dung thay đổi bằng `git diff --cached` hoặc `git diff`.
3. Phân tích loại thay đổi (type) và phạm vi ảnh hưởng (scope).
4. Định dạng và in ra màn hình chat theo mẫu Tiếng Việt:

```markdown
### 📝 Gợi ý Commit Message

**Summary (Tiêu đề commit):**
```text
<type>(<scope>): <mô tả ngắn gọn bằng tiếng Việt, viết chữ thường, không dấu chấm cuối câu>
```

**Description (Mô tả chi tiết bằng tiếng Việt):**
```text
- <Chi tiết thay đổi 1>
- <Chi tiết thay đổi 2>
- <Chi tiết thay đổi 3>
```

**Lệnh Git (nếu muốn chạy qua Terminal):**
```bash
git commit -m "<Summary>" -m "<Chi tiết 1>" -m "<Chi tiết 2>"
```
```

---

### Quy chuẩn Tiền tố (Conventional Commit Types)
* `feat`: Thêm tính năng mới (ví dụ: `feat(storefront): thêm trang chi tiết sản phẩm và bộ chọn biến thể`).
* `fix`: Sửa lỗi (ví dụ: `fix(layout): khắc phục cảnh báo hydration trên root layout`).
* `docs`: Cập nhật tài liệu (ví dụ: `docs(readme): chỉ giữ lại lệnh pnpm và npm`).
* `style`: Chỉnh sửa giao diện, CSS, khoảng cách (ví dụ: `style(pdp): giảm độ dày đường kẻ phân cách`).
* `refactor`: Tái cấu trúc mã nguồn không đổi chức năng (ví dụ: `refactor(cart): tối ưu hàm tính tổng tiền giỏ hàng`).
* `perf`: Cải thiện hiệu năng (ví dụ: `perf(images): tối ưu kích thước ảnh sản phẩm`).
* `test`: Thêm hoặc cập nhật bài test (ví dụ: `test(auth): thêm unit test cho service đăng nhập`).
* `chore`: Cấu hình môi trường, dependencies, công cụ (ví dụ: `chore(git): cấu hình .gitattributes chuẩn hóa dấu xuống dòng LF`).

---

### Ví dụ minh họa (Tiếng Việt)
```text
Summary:
feat(storefront): khởi tạo giao diện storefront b2c, design system và tài liệu kiến trúc

Description:
- Khởi tạo ứng dụng Next.js 16 với hệ thống Design Tokens trên Tailwind CSS v4
- Xây dựng đầy đủ các luồng: Trang chủ, Bộ lọc danh mục, Chi tiết sản phẩm, Giỏ hàng trượt và Thanh toán
- Bổ sung dữ liệu giả lập (mock data), kiểu dữ liệu TypeScript và tầng service mô phỏng
- Hoàn thiện tài liệu kiến trúc hệ thống và thiết kế cơ sở dữ liệu trong thư mục docs/
- Cấu hình môi trường .gitignore, .nvmrc (Node 22) và quy tắc AGENTS.md
```
