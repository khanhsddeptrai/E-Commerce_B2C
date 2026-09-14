---
name: conventional-commit
description: 'Phân tích thay đổi git và sinh thông điệp commit chuẩn Conventional Commits gồm Summary và Description để người dùng tự xem xét và commit.'
---

### Mục đích
Skill này hướng dẫn Agent phân tích các thay đổi trong kho mã nguồn (`git status`, `git diff`) và sinh ra nội dung commit gồm **Summary** và **Description** rõ ràng, chuẩn quy ước **Conventional Commits**.

> [!IMPORTANT]
> **Quy tắc bắt buộc:**
> - **Chỉ in ra nội dung Summary và Description** trong khung chat cho người dùng.
> - **TUYỆT ĐỐI KHÔNG** tự động chạy lệnh `git commit` hoặc `git push`.
> - Người dùng sẽ tự kiểm tra, chỉnh sửa (nếu cần) và tự thực hiện commit/push trên GitHub Desktop hoặc Terminal.

---

### Quy trình thực hiện (Workflow)
1. Kiểm tra danh sách file thay đổi bằng `git status -s`.
2. Kiểm tra chi tiết nội dung thay đổi bằng `git diff --cached` hoặc `git diff`.
3. Phân tích loại thay đổi (type) và phạm vi ảnh hưởng (scope).
4. Định dạng và in ra màn hình chat theo mẫu:

```markdown
### 📝 Gợi ý Commit Message

**Summary (Tiêu đề commit):**
```text
<type>(<scope>): <mô tả ngắn gọn, động từ nguyên mẫu>
```

**Description (Mô tả chi tiết - nếu có):**
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

### Quy chuẩn Tiêu đề (Conventional Commit Types)
* `feat`: Thêm tính năng mới cho ứng dụng.
* `fix`: Sửa lỗi (bug fix).
* `docs`: Cập nhật tài liệu (README, docs, guides).
* `style`: Chỉnh sửa style, CSS, định dạng giao diện, không ảnh hưởng logic.
* `refactor`: Tái cấu trúc mã nguồn mà không thay đổi chức năng.
* `perf`: Cải thiện hiệu năng.
* `test`: Thêm hoặc sửa bài kiểm thử.
* `chore`: Cập nhật cấu hình môi trường, cài đặt thư viện, build tools.

---

### Ví dụ minh họa
```text
Summary:
feat(storefront): initialize b2c storefront with design system and architecture docs

Description:
- Set up Next.js 16 app with Tailwind CSS v4 design tokens
- Implement full storefront flows: Homepage, Catalog filters, PDP, Cart Drawer, and Checkout
- Provide mock data, TypeScript models, and mock service layer
- Add system architecture and database design in docs/
- Configure .gitignore, .nvmrc for Node 22, and AGENTS.md
```
