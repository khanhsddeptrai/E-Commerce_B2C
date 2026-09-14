# 04. Thiết Kế Giao Diện & Design System (Frontend Architecture)

> Tài liệu này chuẩn hóa kiến trúc Frontend Monorepo, định nghĩa Design Tokens, và phân định rõ triết lý thiết kế giữa **Storefront (Khách hàng)** và **Admin Portal (Quản trị viên)**.

---

## 1. Tổ Chức Mã Nguồn Frontend Trong Monorepo

```text
packages/
├── tailwind-config/       # Chia sẻ bộ Design Tokens: Bảng màu, typography, radius, animations
└── ui/                    # Thư viện UI Component dùng chung (Buttons, Inputs, Dialogs, Badges...)
apps/
├── storefront/            # Next.js (App Router) - Giao diện mua sắm bán lẻ cho người tiêu dùng
└── admin/                 # Next.js + Shadcn UI - Trang tổng quan quản trị vận hành
```

---

## 2. Triết Lý & Nguyên Tắc Thiết Kế Tổng Quát (Core Design Principles)

> Tài liệu này đóng vai trò là **kim chỉ nam thiết kế cốt lõi (Style Guide)** cho toàn bộ giao diện của dự án. Mọi màn hình mới cần tuân thủ nghiêm ngặt các nguyên tắc sau để giữ tính đồng nhất và thẩm mỹ cao cấp.

### 2.1. Cảm Quan Thị Giác Tổng Thể (Aesthetic Direction)
* **Phong cách chủ đạo: *Minimalist Industrial Tech*** (Tối giản chuẩn công nghiệp, lấy cảm hứng từ ngôn ngữ thiết kế của Apple, Teenage Engineering và Nothing):
  * **Cấu trúc thị giác tương phản sắc nét**: Kết hợp giữa nền sáng tinh khiết (`#F8FAFC` / `#FFFFFF`) cho phần nội dung mua sắm và các khối tối công nghệ (`#0F172A` / `#020617`) tại các khu vực giới thiệu Flagship (Hero), bảng thông số và chân trang.
  * **Tỷ lệ phối màu 60 - 30 - 10**:
    * **60% Nền chủ đạo**: Trắng và xám Slate nhạt (`#F8FAFC`) tạo cảm giác sạch sẽ, tôn vinh hình ảnh sản phẩm.
    * **30% Khối cấu trúc & Viền**: Midnight Slate (`#0F172A`) cho văn bản, tiêu đề và đường viền mảnh sắc nét (`border-slate-200/80`).
    * **10% Điểm nhấn hành động (Accent)**: Deep Indigo (`#4F46E5`) cho nút mua hàng chính và Cyber Coral (`#F97316`) dành riêng cho Flash Sale / Giảm giá.
  * **Đường nét sắc sảo (Crisp Borders)**: Hạn chế đổ bóng mờ ảo dày đặc (tránh cảm giác "AI generic/SaaS template"). Ưu tiên dùng viền mảnh sắc nét (hairline border) kết hợp đổ bóng rất nhẹ khi hover (`hover:shadow-xl hover:shadow-indigo-500/5`).

### 2.2. Quy Chuẩn Kiểu Chữ & Nội Dung (Typography & Copywriting)
* **Font chữ duy nhất**: **Inter** (Google Fonts) — tối ưu hóa khả năng đọc trên màn hình kỹ thuật số.
* **Quy chuẩn văn bản**:
  * Tiêu đề (Headings): Luôn dùng `tracking-tight`, viết hoa chữ cái đầu câu tự nhiên, **tránh lạm dụng ALL-CAPS** cho các đoạn dài.
  * Thông số kỹ thuật: Hiển thị nổi bật, rõ ràng bằng phông có độ đậm cao (`font-bold` / `font-semibold`), đi kèm đơn vị rõ ràng (ví dụ: `40mm`, `65 Giờ`, `96kHz / 24-bit`, `140W`).
  * Định dạng tiền tệ: Luôn dùng chuẩn định dạng VNĐ với dấu chấm phân tách hàng nghìn và ký hiệu tiền tệ phía sau (`3.490.000 ₫`). Giá gốc gạch ngang màu xám nhạt (`line-through text-slate-400`).
* **Văn phong giao diện (Copywriting)**: Dứt khoát, trực diện, dùng động từ hành động ("Thêm Vào Giỏ Hàng", "Mua Ngay Giao 2H", "Áp Dụng Voucher") thay vì các từ thụ động như "Gửi" hay "OK".

### 2.3. Quy Chuẩn Bố Cục & Bo Góc (Layout & Hierarchy)
* **Hệ thống lưới khoảng cách (8pt Spacing Grid)**: Toàn bộ khoảng cách lề và padding đều là bội số của 8px (`8px`, `16px`, `24px`, `32px`, `48px`, `64px`).
* **Hệ thống phân cấp bo góc (Radius Hierarchy)**:
  * `rounded-full`: Dành cho Tag, Badge trạng thái, bộ đếm số lượng giỏ hàng.
  * `rounded-xl` (12px): Dành cho Nút bấm (Button), Ô nhập liệu (Input), Ô chọn số lượng.
  * `rounded-2xl` (16px): Dành cho Thẻ sản phẩm (`ProductCard`), Khung thông số, Hộp thoại (Modal).
  * `rounded-3xl` (24px): Dành cho Khối Banner lớn (Hero Showcase, Flash Sale Banner).

### 2.4. Quy Chuẩn Tương Tác & Phản Hồi (Interactions & Micro-animations)
* **Phản hồi tức thời (Tactile Feedback)**:
  * Nút bấm và thẻ sản phẩm khi di chuột (Hover): Phóng to nhẹ (`scale-[1.02]` đến `scale-105`), làm sáng màu viền.
  * Khi bấm (Active): Thu nhỏ nhẹ (`active:scale-[0.98]` hoặc `active:scale-95`) tạo cảm giác nút cơ học chân thực.
* **Luôn xử lý đủ 4 trạng thái cốt lõi của giao diện (The 4 UI States)**:
  1. **Loading State**: Sử dụng hiệu ứng khung xương (Skeleton pulse) mô phỏng chính xác layout thay vì chỉ hiện spinner đơn điệu.
  2. **Success / Populated State**: Giao diện khi có đầy đủ dữ liệu mượt mà.
  3. **Empty State**: Khi giỏ hàng trống hoặc tìm kiếm không có kết quả, luôn cung cấp hình minh họa tối giản kèm **nút kêu gọi hành động cụ thể** ("Khám phá sản phẩm ngay" hoặc "Xóa bộ lọc").
  4. **Error State**: Thông báo lỗi rõ ràng nguyên nhân (ví dụ: "Mã giảm giá đã hết hạn").

### 2.5. Những Điều Tuyệt Đối Tránh (Anti-Patterns / Không làm)
* ❌ Không dùng các dải màu gradient trang trí lòe loẹt, vô nghĩa.
* ❌ Không cắt nhỏ nội dung thành những khối card giống hệt nhau với cùng một kiểu đổ bóng mờ nhạt xám xịt ("SaaS card kit").
* ❌ Không bao giờ hardcode dữ liệu tĩnh trực tiếp trong component JSX; toàn bộ dữ liệu phải đi qua tầng Data Service ([productService.ts](file:///d:/MyProject/E-Commerce_B2C/apps/storefront/src/services/productService.ts)).


---

## 3. Hệ Thống Design Tokens (`@repo/tailwind-config` - Tailwind CSS v4)

Với **Tailwind CSS v4**, toàn bộ Design Tokens được định nghĩa thuần túy qua CSS bằng directive `@theme` và CSS Variables thay vì file `tailwind.config.js` truyền thống.

## 3. Hệ Thống Design Tokens Chuẩn Hóa (`@repo/tailwind-config` - Tailwind CSS v4)

Toàn bộ Design Tokens được định nghĩa đồng bộ qua CSS Variables và directive `@theme` trong Tailwind CSS v4, đảm bảo tái sử dụng xuyên suốt giữa `apps/storefront` và `apps/admin`.

### 3.1. Bảng Màu Chi Tiết & Các Dải Tương Tác (Full Color Tokens)
```css
:root {
  /* 1. Nền và Chữ Cơ Bản (Base Surfaces) */
  --background: #f8fafc;          /* Nền trang sáng dịu (Slate-50) */
  --foreground: #0f172a;          /* Chữ chính màu than đậm (Slate-900) */
  --surface-card: #ffffff;        /* Nền thẻ sản phẩm / Modal trắng tinh */
  --surface-muted: #f1f5f9;       /* Nền khối thứ cấp / Input (Slate-100) */
  --border-color: #e2e8f0;        /* Viền mảnh mặc định (Slate-200) */
  --border-hover: #cbd5e1;        /* Viền khi di chuột (Slate-300) */

  /* 2. Màu Thương Hiệu Chủ Đạo (Primary - Deep Indigo) */
  --primary: #4f46e5;             /* Màu nút chính, liên kết chủ đạo */
  --primary-hover: #4338ca;       /* Màu hover nút chính */
  --primary-light: #eef2ff;       /* Nền tag, badge, trạng thái chọn (Indigo-50) */
  --primary-foreground: #ffffff;  /* Chữ trên nền primary */

  /* 3. Màu Điểm Nhấn (Accent - Cyber Coral / Tangerine) */
  --accent: #f97316;              /* Huy hiệu Flash Sale, đồng hồ đếm ngược */
  --accent-hover: #ea580c;        /* Hover accent */
  --accent-light: #fff7ed;        /* Nền mờ thông báo giảm giá (Orange-50) */
  --accent-foreground: #ffffff;

  /* 4. Khối Công Nghệ Tương Phản (Midnight Slate) */
  --dark-surface: #090d16;        /* Nền Hero Flagship, Footer */
  --dark-card: #0f172a;           /* Khối thông số kỹ thuật tối màu */
  --dark-border: #1e293b;         /* Viền trên nền tối */

  /* 5. Cảnh Báo & Trạng Thái Hệ Thống (Functional Status) */
  --success: #10b981;             /* Còn hàng, đặt hàng thành công, freeship */
  --destructive: #ef4444;         /* Hết hàng, hủy đơn, lỗi xác thực */
  --warning: #f59e0b;             /* Sắp hết hàng, sao đánh giá rating */
}
```

### 3.2. Hệ Thống Bo Góc Chuẩn Hóa (Border Radius Tokens)
Hệ thống bo góc được phân cấp nghiêm ngặt theo kích thước và vai trò của từng thành phần:

| Token Tailwind | Giá trị Pixel / Rem | Thành Phần Áp Dụng Cụ Thể |
| :--- | :--- | :--- |
| `rounded-full` | `9999px` | Badge trạng thái, Pill giảm giá (`-25%`), Chấm màu Swatches, Badge đếm giỏ hàng. |
| `rounded-xl` | `0.75rem (12px)` | Nút bấm (`Button`), Ô nhập (`Input/Textarea`), Cụm nút số lượng (`QuantitySelector`). |
| `rounded-2xl` | `1rem (16px)` | Thẻ sản phẩm (`ProductCard`), Khung thông số kỹ thuật, Ngăn kéo (`CartDrawer`). |
| `rounded-3xl` | `1.5rem (24px)` | Khối Banner lớn (Hero Showcase, Khối Flash Sale toàn trang), Modal thông báo lớn. |

### 3.3. Hệ Thống Bóng Đổ & Hiệu Ứng Nổi (Elevation & Shadow Tokens)
Tuyệt đối tránh đổ bóng xám đen dày đặc; ưu tiên dùng bóng có pha sắc tố nhẹ (colored tint shadow):
* **Bình thường (Default Card)**: Viền mảnh `border border-slate-200/80` + `shadow-sm` (tinh tế, phẳng).
* **Khi Hover (Active Elevation)**: `hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5` (phát quang sắc tím nhẹ, cảm giác nâng lên 3D).
* **Modal / Drawer Overlay**: `shadow-2xl` kết hợp nền mờ `backdrop-blur-sm bg-slate-900/60`.

### 3.4. Hệ Thống Phân Tầng Hiển Thị (Z-Index Layering Scale)
* `z-10`: Nhãn đè trên ảnh sản phẩm (Flash Sale, New Badge).
* `z-20`: Khối Dropdown gợi ý tìm kiếm (Search Autocomplete).
* `z-40`: Thanh điều hướng cố định đỉnh trang (`Navbar sticky`).
* `z-50`: Ngăn kéo trượt giỏ hàng (`CartDrawer`), Hộp thoại xác nhận (`Modal`).
* `z-60`: Thông báo nổi góc màn hình (`Toast feedback`).

### 3.5. Quy Chuẩn Thời Gian Chuyển Động (Transition & Durations)
* **Tức thời (150ms)**: Hiệu ứng bấm nút (`active:scale-95`), chuyển màu viền tab.
* **Mượt mà (200ms - 300ms)**: Đóng/mở Slide-over Cart Drawer, Toast bay lên từ dưới đáy màn hình.
* **Hình ảnh (500ms - 700ms)**: Phóng to thu nhỏ ảnh sản phẩm khi hover (`group-hover:scale-105 duration-500`).


---

## 4. Danh Mục Component Cốt Lõi (`packages/ui`)

| Phân Loại | Tên Component | Mục Đích Sử Dụng |
| :--- | :--- | :--- |
| **Atoms** | `Button` | Nút bấm đa trạng thái (Primary, Outline, Ghost, Loading spinner) |
| | `Input` / `Textarea` | Ô nhập liệu có validation status (Error, Success) |
| | `Badge` | Nhãn trạng thái đơn (`PENDING`, `CONFIRMED`) hoặc tag giảm giá (`-30%`) |
| | `Skeleton` | Khung xương placeholder khi tải dữ liệu sản phẩm |
| **Molecules** | `ProductCard` | Thẻ sản phẩm hiển thị ảnh, tên, giá bán, giá gạch, nút thêm giỏ |
| | `PriceDisplay` | Định dạng tiền tệ VNĐ chuẩn (`450.000 ₫`) kèm % giảm giá |
| | `QuantitySelector` | Cụm nút `[-] [1] [+]` tăng giảm số lượng mua |
| **Organisms** | `CartDrawer` | Thanh trượt giỏ hàng nhanh bên phải màn hình |
| | `OrderTimeline` | Dòng thời gian trực quan theo dõi trạng thái vận chuyển |
| | `ChatFloatingWidget`| Cửa sổ chat nổi góc phải màn hình kết nối CSKH |

