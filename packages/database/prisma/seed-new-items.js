const path = require('path');
const fs = require('fs');

// Load .env
const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(process.cwd(), '.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    try {
      require('dotenv').config({ path: p });
    } catch {}
  }
}

const { PrismaClient } = require('../src/generated/product-client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.PRODUCT_DATABASE_URL ||
        'postgresql://postgres:postgrespassword@localhost:5432/product_db?schema=public',
    },
  },
});

async function main() {
  console.log('🚀 Đang thêm 15 sản phẩm (5 Bàn phím cơ AULA/CIDOO, 5 Màn hình rời, 5 Chuột không dây)...');

  // 1. Tạo Brands
  const brandNova = await prisma.brand.upsert({
    where: { slug: 'nova-tech' },
    update: {},
    create: {
      name: 'NOVA TECH',
      slug: 'nova-tech',
    },
  });

  const brandAula = await prisma.brand.upsert({
    where: { slug: 'aula' },
    update: {},
    create: {
      name: 'AULA',
      slug: 'aula',
    },
  });

  const brandCidoo = await prisma.brand.upsert({
    where: { slug: 'cidoo' },
    update: {},
    create: {
      name: 'CIDOO',
      slug: 'cidoo',
    },
  });

  // 2. Tạo/Cập nhật Categories
  const catKeyboard = await prisma.category.upsert({
    where: { slug: 'ban-phim-co' },
    update: {
      name: 'Bàn Phím Cơ & Custom',
      description: 'Bàn phím cơ Gasket Mount, nhôm CNC, Switch hotswap đa chế độ kết nối.',
      icon: 'Keyboard',
      imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
      displayOrder: 2,
    },
    create: {
      name: 'Bàn Phím Cơ & Custom',
      slug: 'ban-phim-co',
      description: 'Bàn phím cơ Gasket Mount, nhôm CNC, Switch hotswap đa chế độ kết nối.',
      icon: 'Keyboard',
      imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
      displayOrder: 2,
    },
  });

  const catMonitor = await prisma.category.upsert({
    where: { slug: 'man-hinh-roi' },
    update: {
      name: 'Màn Hình Rời & Di Động',
      description: 'Màn hình đồ họa 4K, màn cong OLED gaming và màn hình di động Type-C siêu mỏng.',
      icon: 'Monitor',
      imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80',
      displayOrder: 3,
    },
    create: {
      name: 'Màn Hình Rời & Di Động',
      slug: 'man-hinh-roi',
      description: 'Màn hình đồ họa 4K, màn cong OLED gaming và màn hình di động Type-C siêu mỏng.',
      icon: 'Monitor',
      imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80',
      displayOrder: 3,
    },
  });

  const catMouse = await prisma.category.upsert({
    where: { slug: 'chuot-khong-day' },
    update: {
      name: 'Chuột Không Dây & Gaming',
      description: 'Chuột công thái học bảo vệ cổ tay, chuột gaming siêu nhẹ PAW3395 8K polling rate.',
      icon: 'Mouse',
      imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80',
      displayOrder: 4,
    },
    create: {
      name: 'Chuột Không Dây & Gaming',
      slug: 'chuot-khong-day',
      description: 'Chuột công thái học bảo vệ cổ tay, chuột gaming siêu nhẹ PAW3395 8K polling rate.',
      icon: 'Mouse',
      imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80',
      displayOrder: 4,
    },
  });

  const PRODUCTS_DATA = [
    // ==========================================
    // NHÓM 1: 5 BÀN PHÍM CƠ (HÃNG AULA & CIDOO)
    // ==========================================
    {
      name: 'AULA F75 Wireless Gasket 75%',
      slug: 'aula-f75-wireless-gasket-75',
      tagline: 'Bàn phím cơ quốc dân 3-mode, cấu trúc Gasket Mount 5 lớp tiêu âm cực êm',
      description:
        'AULA F75 là mẫu bàn phím cơ không dây nổi tiếng bậc nhất phân khúc với cấu trúc Gasket Mount kết hợp 5 lớp foam tiêu âm Poron/IXPE, mang lại cảm giác gõ đầm chắc, âm thanh trầm ấm (clacky/thocky). Tích hợp núm xoay kim loại tiện dụng, kết nối 3 chế độ mượt mà cùng thời lượng pin 4000mAh.',
      basePrice: 1290000,
      originalPrice: 1590000,
      brandId: brandAula.id,
      categoryId: catKeyboard.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
      badge: 'BÁN CHẠY NHẤT',
      featured: true,
      isFlashSale: true,
      flashSaleSold: 78,
      flashSaleTotal: 100,
      rating: 4.9,
      reviewCount: 312,
      images: [
        'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'AULA-F75-GLACIER-BLUE',
          name: 'Glacier Blue (TTC Iron Linear)',
          colorName: 'Glacier Blue',
          colorHex: '#6BA4B8',
          price: 1290000,
          originalPrice: 1590000,
          stockQuantity: 45,
          imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
        },
        {
          skuCode: 'AULA-F75-SEASALT-WHITE',
          name: 'Sea Salt White (Reaper Switch)',
          colorName: 'Sea Salt White',
          colorHex: '#EAEAEA',
          price: 1350000,
          originalPrice: 1650000,
          stockQuantity: 30,
          imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Layout', value: '75% (80 phím + Núm xoay kim loại)', displayOrder: 1 },
        { label: 'Cấu trúc', value: 'Gasket Mount 5 lớp tiêu âm Poron/IXPE', displayOrder: 2 },
        { label: 'Kết nối', value: '3 Chế độ (Type-C, 2.4GHz, Bluetooth 5.0)', displayOrder: 3 },
        { label: 'Keycap', value: 'PBT Double-Shot Cherry Profile', displayOrder: 4 },
        { label: 'Mạch & LED', value: 'Hotswap 5-pin mạch xuôi, RGB 16.8 triệu màu', displayOrder: 5 },
        { label: 'Dung lượng pin', value: '4000mAh (Lên tới 17.5 giờ mở LED, 260 giờ tắt LED)', displayOrder: 6 },
      ],
    },

    {
      name: 'AULA F87 Pro TKL RGB Mạch Xuôi',
      slug: 'aula-f87-pro-tkl-rgb-mach-xuoi',
      tagline: 'Layout TKL 87 phím tiêu chuẩn, mạch xuôi South-Facing LED RGB sống động',
      description:
        'AULA F87 Pro mang đến trải nghiệm gõ phím hoàn hảo cho cả lập trình viên và game thủ với layout TKL rộng rãi. Thiết kế mạch xuôi South-Facing chống cấn keycap, hệ thống đệm silicon và foam Poron hấp thụ hoàn toàn tạp âm rỗng.',
      basePrice: 1150000,
      originalPrice: 1390000,
      brandId: brandAula.id,
      categoryId: catKeyboard.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80',
      badge: 'GIẢM 20%',
      featured: false,
      isFlashSale: false,
      rating: 4.8,
      reviewCount: 195,
      images: [
        'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'AULA-F87-STAR-BLACK',
          name: 'Starry Black (Nimbus V3 Switch)',
          colorName: 'Starry Black',
          colorHex: '#1E232A',
          price: 1150000,
          originalPrice: 1390000,
          stockQuantity: 35,
          imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Layout', value: 'TKL 87 Phím tiêu chuẩn', displayOrder: 1 },
        { label: 'Switch', value: 'LEOBOG Nimbus V3 Linear Factory Lubed', displayOrder: 2 },
        { label: 'Kết nối', value: 'Type-C, Wireless 2.4Ghz, Bluetooth 5.0', displayOrder: 3 },
        { label: 'Độ trễ', value: '1ms (Polling rate 1000Hz)', displayOrder: 4 },
        { label: 'Dung lượng pin', value: '4000mAh Lithium', displayOrder: 5 },
      ],
    },

    {
      name: 'AULA F99 Pro 3-Mode Gasket Mount',
      slug: 'aula-f99-pro-3-mode-gasket-mount',
      tagline: 'Bàn phím full cụm số 99 phím nhỏ gọn, dung lượng pin khủng 8000mAh',
      description:
        'AULA F99 Pro là sự lựa chọn tối thượng cho dân kế toán, văn phòng và game thủ cần bàn phím số Numpad nhưng muốn giữ diện tích bàn làm việc gọn gàng. Trang bị viên pin kép 8000mAh cho thời gian làm việc bền bỉ hàng tháng không cần sạc.',
      basePrice: 1590000,
      originalPrice: 1890000,
      brandId: brandAula.id,
      categoryId: catKeyboard.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80',
      badge: 'PIN 8000MAH',
      featured: true,
      isFlashSale: false,
      rating: 4.9,
      reviewCount: 142,
      images: [
        'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'AULA-F99-DARK-KNIGHT',
          name: 'Dark Knight (Flame Purple Switch)',
          colorName: 'Dark Knight',
          colorHex: '#26292E',
          price: 1590000,
          originalPrice: 1890000,
          stockQuantity: 28,
          imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Layout', value: '99 Phím (Tích hợp Numpad số)', displayOrder: 1 },
        { label: 'Pin', value: '8000mAh Dual-Cell (Lên tới 400 giờ)', displayOrder: 2 },
        { label: 'Mạch', value: 'Flex-cut PCB từng phím, Hotswap 5-pin', displayOrder: 3 },
        { label: 'Plate', value: 'FR4 mạ vàng cao cấp', displayOrder: 4 },
      ],
    },

    {
      name: 'CIDOO V65 Pro CNC Aluminum V2',
      slug: 'cidoo-v65-pro-cnc-aluminum-v2',
      tagline: 'Vỏ nhôm CNC 6063 nguyên khối anốt hóa, núm xoay kim loại, hỗ trợ VIA/QMK',
      description:
        'CIDOO V65 Pro mang tiêu chuẩn phím cơ Custom cao cấp đến bàn làm việc của bạn. Thân vỏ hợp kim nhôm 6063 tiện CNC đầm chắc nặng 1.4kg chống rung hoàn hảo. Hỗ trợ lập trình phím không giới hạn qua web VIA/QMK.',
      basePrice: 2890000,
      originalPrice: 3490000,
      brandId: brandCidoo.id,
      categoryId: catKeyboard.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1541140532154-b024d705b909?w=800&auto=format&fit=crop&q=80',
      badge: 'CUSTOM NHÔM CNC',
      featured: true,
      isFlashSale: true,
      flashSaleSold: 18,
      flashSaleTotal: 25,
      rating: 5.0,
      reviewCount: 88,
      images: [
        'https://images.unsplash.com/photo-1541140532154-b024d705b909?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'CIDOO-V65-WARM-GRAY',
          name: 'Retro Warm Gray (CIDOO Matte Linear)',
          colorName: 'Warm Gray',
          colorHex: '#7D7B7A',
          price: 2890000,
          originalPrice: 3490000,
          stockQuantity: 15,
          imageUrl: 'https://images.unsplash.com/photo-1541140532154-b024d705b909?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Vỏ phím', value: 'Nhôm 6063 CNC nguyên khối Anodized (Trọng lượng 1.4kg)', displayOrder: 1 },
        { label: 'Khả năng tùy biến', value: 'Hỗ trợ phần mềm VIA/QMK tương thích macOS & Windows', displayOrder: 2 },
        { label: 'Switch', value: 'CIDOO Matte Linear 47g đã Lube sẵn mượt mà', displayOrder: 3 },
        { label: 'Plate', value: 'Polycarbonate đục Flex-cut', displayOrder: 4 },
        { label: 'Pin', value: '3000mAh', displayOrder: 5 },
      ],
    },

    {
      name: 'CIDOO Nebula 68 Retro Wireless RGB',
      slug: 'cidoo-nebula-68-retro-wireless-rgb',
      tagline: 'Thiết kế Retro cổ điển thập niên 90, màn hình mini hiển thị ảnh GIF & thông tin',
      description:
        'Lấy cảm hứng từ những cỗ máy vi tính cổ điển, CIDOO Nebula 68 kết hợp giữa nét hoài niệm và công nghệ hiện đại với màn hình hiển thị ảnh GIF độc đáo, núm xoay kim loại và hệ thống switch CIDOO Carda độc quyền.',
      basePrice: 2390000,
      originalPrice: 2790000,
      brandId: brandCidoo.id,
      categoryId: catKeyboard.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=800&auto=format&fit=crop&q=80',
      badge: 'MÀN HÌNH GIF',
      featured: false,
      isFlashSale: false,
      rating: 4.8,
      reviewCount: 64,
      images: [
        'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'CIDOO-NEBULA-RETRO',
          name: 'Classic Vintage Retro (Carda Switch)',
          colorName: 'Vintage Ivory',
          colorHex: '#DED6C9',
          price: 2390000,
          originalPrice: 2790000,
          stockQuantity: 20,
          imageUrl: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Layout', value: '68 Phím + Màn hình màu OLED Mini + Núm xoay', displayOrder: 1 },
        { label: 'Keycap', value: 'PBT Dye-Sub Retro Vintage Profile', displayOrder: 2 },
        { label: 'Kết nối', value: 'Bluetooth 5.0, 2.4Ghz, Type-C rời', displayOrder: 3 },
        { label: 'Pin', value: '4000mAh sạc nhanh', displayOrder: 4 },
      ],
    },

    // ==========================================
    // NHÓM 2: 5 MÀN HÌNH RỜI & DI ĐỘNG
    // ==========================================
    {
      name: 'NovaView Ultra 27 4K IPS Pro',
      slug: 'novaview-ultra-27-4k-ips-pro',
      tagline: 'Màn hình đồ họa 27 inch 4K UHD, 100% sRGB Delta E < 1, Type-C 90W PD sạc laptop',
      description:
        'NovaView Ultra 27 được tinh chỉnh chuẩn mực cho nhà sáng tạo nội dung, đồ họa và dựng phim. Độ phân giải 4K sắc nét 163 PPI, độ phủ màu 98% DCI-P3 cùng cổng kết nối Type-C 90W truyền hình ảnh và sạc đầy laptop qua một sợi cáp duy nhất.',
      basePrice: 7490000,
      originalPrice: 8990000,
      brandId: brandNova.id,
      categoryId: catMonitor.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80',
      badge: 'ĐỒ HỌA CHUYÊN NGHIỆP',
      featured: true,
      isFlashSale: false,
      rating: 4.9,
      reviewCount: 96,
      images: [
        'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'NOVAVIEW-27-4K-SILVER',
          name: 'Space Silver (Chân đế Ergonomic nâng hạ xoay 90°)',
          colorName: 'Space Silver',
          colorHex: '#C0C0C0',
          price: 7490000,
          originalPrice: 8990000,
          stockQuantity: 25,
          imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Kích thước & Tấm nền', value: '27 Inch IPS Anti-Glare 4K UHD (3840 x 2160)', displayOrder: 1 },
        { label: 'Độ chính xác màu', value: '100% sRGB, 98% DCI-P3, Delta E < 1.0 Calibrated', displayOrder: 2 },
        { label: 'Cổng kết nối', value: '1x USB-C 90W PD, 2x HDMI 2.1, 1x DP 1.4, 2x USB-A 3.2 Hub', displayOrder: 3 },
        { label: 'Độ sáng & HDR', value: '400 nits, VESA DisplayHDR 400', displayOrder: 4 },
        { label: 'Chân đế', value: 'Nâng hạ 130mm, Xoay dọc 90°, Nghiêng góc -5° ~ +20°', displayOrder: 5 },
      ],
    },

    {
      name: 'NovaVision Pro 34 Curved OLED UltraWide',
      slug: 'novavision-pro-34-curved-oled-ultrawide',
      tagline: 'Màn hình cong 1800R tỉ lệ 21:9 chuẩn điện ảnh, tấm nền QD-OLED 175Hz phản hồi 0.03ms',
      description:
        'Trải nghiệm thị giác siêu thực với tấm nền Quantum Dot OLED thế hệ mới. Màu đen tuyệt đối vô cực, tần số quét 175Hz mượt mà cùng tỉ lệ khung hình siêu rộng 21:9 tối ưu không gian đa nhiệm và đắm chìm trong các tựa game AAA đỉnh cao.',
      basePrice: 19990000,
      originalPrice: 23500000,
      brandId: brandNova.id,
      categoryId: catMonitor.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=800&auto=format&fit=crop&q=80',
      badge: 'FLAGSHIP GAMING',
      featured: true,
      isFlashSale: false,
      rating: 5.0,
      reviewCount: 47,
      images: [
        'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'NOVAVISION-34-OLED-BLACK',
          name: 'Midnight Black (QD-OLED 175Hz)',
          colorName: 'Midnight Black',
          colorHex: '#121316',
          price: 19990000,
          originalPrice: 23500000,
          stockQuantity: 10,
          imageUrl: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Kích thước & Tấm nền', value: '34 Inch WQHD Curved 1800R (3440 x 1440) QD-OLED', displayOrder: 1 },
        { label: 'Tần số quét & Phản hồi', value: '175Hz, 0.03ms (GtG)', displayOrder: 2 },
        { label: 'Độ tương phản', value: '1.500.000:1 True Black 400', displayOrder: 3 },
        { label: 'Bảo vệ OLED', value: 'Công nghệ Pixel Refresh & Tản nhiệt Graphene chống burn-in', displayOrder: 4 },
      ],
    },

    {
      name: 'NovaPocket 16 OLED Portable Touch',
      slug: 'novapocket-16-oled-portable-touch',
      tagline: 'Màn hình rời di động 16 inch 2.5K OLED, cảm biến 10 điểm chạm, siêu mỏng nhẹ 750g',
      description:
        'Giải pháp màn hình phụ di động hoàn hảo cho kỹ sư phần mềm, nhà thiết kế và doanh nhân thường xuyên di chuyển. Tấm nền OLED 2.5K tỉ lệ vàng 16:10, hỗ trợ cảm ứng đa điểm mượt mà và cấp nguồn trực tiếp từ laptop/điện thoại.',
      basePrice: 5290000,
      originalPrice: 6200000,
      brandId: brandNova.id,
      categoryId: catMonitor.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
      badge: 'CẢM ỨNG DI ĐỘNG',
      featured: false,
      isFlashSale: true,
      flashSaleSold: 32,
      flashSaleTotal: 50,
      rating: 4.8,
      reviewCount: 79,
      images: [
        'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'NOVAPOCKET-16-OLED',
          name: 'Slate Titanium (Kèm Smart Cover nam châm)',
          colorName: 'Slate Titanium',
          colorHex: '#3E424B',
          price: 5290000,
          originalPrice: 6200000,
          stockQuantity: 25,
          imageUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Kích thước', value: '16.0 Inch OLED 2.5K (2560 x 1600) Tỉ lệ 16:10', displayOrder: 1 },
        { label: 'Cảm ứng', value: 'Capacitive 10-Point Touch (Hỗ trợ bút cảm ứng)', displayOrder: 2 },
        { label: 'Trọng lượng & Độ dày', value: '750g, Điểm mỏng nhất chỉ 4.8mm', displayOrder: 3 },
        { label: 'Cổng kết nối', value: '2x Type-C Full Feature, 1x Mini-HDMI, Loa kép stereo', displayOrder: 4 },
      ],
    },

    {
      name: 'NovaView 24 Fast IPS 180Hz Esports',
      slug: 'novaview-24-fast-ips-180hz-esports',
      tagline: 'Vũ khí thể thao điện tử FPS, tốc độ quét 180Hz 1ms MPRT cùng FreeSync Premium',
      description:
        'Tối ưu tuyệt đối cho các tựa game bắn súng góc nhìn thứ nhất (CS2, Valorant). Tấm nền Fast IPS thế hệ mới triệt tiêu hoàn toàn bóng ma ghosting, mang đến từng khung hình sắc lẹm và chuẩn xác.',
      basePrice: 3290000,
      originalPrice: 3890000,
      brandId: brandNova.id,
      categoryId: catMonitor.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
      badge: '180HZ ESPORTS',
      featured: false,
      isFlashSale: false,
      rating: 4.7,
      reviewCount: 165,
      images: [
        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'NOVAVIEW-24-180HZ-BLACK',
          name: 'Matte Stealth Black',
          colorName: 'Matte Black',
          colorHex: '#18181B',
          price: 3290000,
          originalPrice: 3890000,
          stockQuantity: 40,
          imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Kích thước', value: '24.5 Inch Fast IPS FHD (1920 x 1080)', displayOrder: 1 },
        { label: 'Tần số & Tốc độ', value: '180Hz, 1ms (GtG) / 0.5ms (MPRT)', displayOrder: 2 },
        { label: 'Đồng bộ hình ảnh', value: 'AMD FreeSync Premium & G-Sync Compatible', displayOrder: 3 },
      ],
    },

    {
      name: 'NovaFlex 15.6 FHD Type-C Travel',
      slug: 'novaflex-15-6-fhd-type-c-travel',
      tagline: 'Màn hình mở rộng di động cắm là chạy 1 cáp USB-C cho MacBook, Laptop & Switch',
      description:
        'Nhân đôi hiệu suất làm việc mọi lúc mọi nơi cùng NovaFlex 15.6. Vỏ kim loại nguyên khối sang trọng, góc nhìn rộng 178 độ chống mỏi mắt và tương thích ngay lập tức với mọi thiết bị không cần cài đặt driver.',
      basePrice: 2690000,
      originalPrice: 3200000,
      brandId: brandNova.id,
      categoryId: catMonitor.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&auto=format&fit=crop&q=80',
      badge: 'TIỆN LỢI',
      featured: false,
      isFlashSale: false,
      rating: 4.6,
      reviewCount: 110,
      images: [
        'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'NOVAFLEX-15-FHD-GRAY',
          name: 'Aluminum Charcoal Gray',
          colorName: 'Charcoal Gray',
          colorHex: '#474D58',
          price: 2690000,
          originalPrice: 3200000,
          stockQuantity: 30,
          imageUrl: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Kích thước', value: '15.6 Inch IPS Anti-Glare FHD (1920 x 1080)', displayOrder: 1 },
        { label: 'Trọng lượng', value: '620g', displayOrder: 2 },
        { label: 'Cổng giao tiếp', value: '2x Type-C, 1x Mini HDMI, Jack 3.5mm', displayOrder: 3 },
      ],
    },

    // ==========================================
    // NHÓM 3: 5 CHUỘT KHÔNG DÂY
    // ==========================================
    {
      name: 'Nova Glide Pro Wireless UltraLight 49g',
      slug: 'nova-glide-pro-wireless-ultralight-49g',
      tagline: 'Chuột gaming siêu nhẹ chỉ 49 gram, cảm biến quang học đỉnh cao PixArt PAW3395 26.000 DPI',
      description:
        'Cầm nắm như không với trọng lượng lông vũ 49g. Trang bị cảm biến flagship PAW3395 kết hợp switch Huano Blue Shell Pink Dot 80 triệu lần nhấn, cho tốc độ vẩy chuột siêu tốc không mỏi cổ tay trong các trận đấu kéo dài.',
      basePrice: 1490000,
      originalPrice: 1890000,
      brandId: brandNova.id,
      categoryId: catMouse.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80',
      badge: 'BÁN CHẠY',
      featured: true,
      isFlashSale: true,
      flashSaleSold: 65,
      flashSaleTotal: 80,
      rating: 4.9,
      reviewCount: 238,
      images: [
        'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'NOVA-GLIDE-PRO-WHITE',
          name: 'Frost White (Huano Pink Dot 80M)',
          colorName: 'Frost White',
          colorHex: '#F5F5F7',
          price: 1490000,
          originalPrice: 1890000,
          stockQuantity: 40,
          imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80',
        },
        {
          skuCode: 'NOVA-GLIDE-PRO-BLACK',
          name: 'Stealth Black (Huano Pink Dot 80M)',
          colorName: 'Stealth Black',
          colorHex: '#1C1D21',
          price: 1490000,
          originalPrice: 1890000,
          stockQuantity: 35,
          imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Cảm biến', value: 'PixArt PAW3395 (26,000 DPI, 650 IPS, 50G gia tốc)', displayOrder: 1 },
        { label: 'Trọng lượng', value: '49 Grams (Vỏ đặc không đục lỗ)', displayOrder: 2 },
        { label: 'Switch', value: 'Huano Blue Shell Pink Dot (Tuổi thọ 80 triệu lần nhấn)', displayOrder: 3 },
        { label: 'Kết nối', value: 'Wireless 2.4GHz không độ trễ, Bluetooth 5.2, Dây bọc dù Type-C', displayOrder: 4 },
        { label: 'Thời lượng pin', value: '80 Giờ liên tục (Pin 300mAh sạc nhanh)', displayOrder: 5 },
      ],
    },

    {
      name: 'Nova ErgoMaster 3X Wireless Productivity',
      slug: 'nova-ergomaster-3x-wireless',
      tagline: 'Chuột công thái học văn phòng đa năng, con lăn điện từ MagSpeed cuộn 1.000 dòng/giây',
      description:
        'Biểu tượng năng suất cho giới chuyên nghiệp. Thiết kế ôm trọn lòng bàn tay công thái học, con lăn thép điện từ MagSpeed thông minh tự chuyển đổi giữa cuộn từng nấc và cuộn vô cực lướt qua hàng nghìn trang tài liệu.',
      basePrice: 1990000,
      originalPrice: 2390000,
      brandId: brandNova.id,
      categoryId: catMouse.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80',
      badge: 'CÔNG THÁI HỌC',
      featured: true,
      isFlashSale: false,
      rating: 4.9,
      reviewCount: 180,
      images: [
        'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'NOVA-ERGOMASTER-GRAPHITE',
          name: 'Graphite Dark Gray',
          colorName: 'Graphite Dark Gray',
          colorHex: '#323438',
          price: 1990000,
          originalPrice: 2390000,
          stockQuantity: 30,
          imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Con lăn', value: 'MagSpeed SmartShift điện từ siêu tốc 1.000 dòng/giây', displayOrder: 1 },
        { label: 'Đa thiết bị', value: 'Chuyển đổi 3 thiết bị cùng lúc (Easy-Switch)', displayOrder: 2 },
        { label: 'Cảm biến', value: 'Darkfield Laser 8000 DPI (Lướt êm trên cả mặt kính trong)', displayOrder: 3 },
        { label: 'Pin', value: 'Lên tới 70 ngày sau 1 lần sạc đầy', displayOrder: 4 },
      ],
    },

    {
      name: 'Nova SilentClick Air Wireless Slim',
      slug: 'nova-silentclick-air-wireless',
      tagline: 'Thiết kế siêu mỏng bỏ túi tối giản, nút bấm triệt tiêu tiếng ồn 99% cho văn phòng',
      description:
        'Người bạn đồng hành gọn nhẹ bên chiếc máy tính xách tay của bạn. Độ dày chỉ 22mm dễ dàng bỏ vào túi chống sốc, cùng công nghệ phím bấm Silent Switch giảm 99% tiếng ồn để làm việc thoải mái nơi công cộng.',
      basePrice: 490000,
      originalPrice: 650000,
      brandId: brandNova.id,
      categoryId: catMouse.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1615663246221-a083d0309995?w=800&auto=format&fit=crop&q=80',
      badge: 'CHỐNG ỒN 99%',
      featured: false,
      isFlashSale: false,
      rating: 4.7,
      reviewCount: 310,
      images: [
        'https://images.unsplash.com/photo-1615663246221-a083d0309995?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'NOVA-SILENT-WHITE',
          name: 'Pearl White (Silent Switch)',
          colorName: 'Pearl White',
          colorHex: '#FAF9F6',
          price: 490000,
          originalPrice: 650000,
          stockQuantity: 60,
          imageUrl: 'https://images.unsplash.com/photo-1615663246221-a083d0309995?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Độ ồn', value: 'Silent Click giảm 99% tiếng ồn', displayOrder: 1 },
        { label: 'Độ dày', value: 'Siêu mỏng 22mm, trọng lượng 68g', displayOrder: 2 },
        { label: 'Kết nối', value: 'Bluetooth 5.3 & 2.4GHz Nano Receiver', displayOrder: 3 },
      ],
    },

    {
      name: 'Nova Carbon Viper 8K Wireless Esports',
      slug: 'nova-carbon-viper-8k-wireless',
      tagline: 'Đẳng cấp Esports với Polling rate thực 8000Hz, độ trễ không dây dưới 0.125ms',
      description:
        'Sinh ra để thống trị các giải đấu thể thao điện tử chuyên nghiệp. Bộ phát HyperPolling 8000Hz truyền tải tín hiệu nhanh gấp 8 lần chuột gaming thông thường, đảm bảo mọi cú flick shot đều tức thời và chính xác tuyệt đối.',
      basePrice: 2690000,
      originalPrice: 3190000,
      brandId: brandNova.id,
      categoryId: catMouse.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1613141411244-0e4ac259d217?w=800&auto=format&fit=crop&q=80',
      badge: 'PRO ESPORTS 8K',
      featured: true,
      isFlashSale: false,
      rating: 5.0,
      reviewCount: 92,
      images: [
        'https://images.unsplash.com/photo-1613141411244-0e4ac259d217?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'NOVA-VIPER-8K-BLACK',
          name: 'Matte Carbon Black (Kèm Dongle 8000Hz)',
          colorName: 'Carbon Black',
          colorHex: '#141417',
          price: 2690000,
          originalPrice: 3190000,
          stockQuantity: 20,
          imageUrl: 'https://images.unsplash.com/photo-1613141411244-0e4ac259d217?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Tần số phản hồi', value: '8000Hz HyperPolling (Độ trễ 0.125ms)', displayOrder: 1 },
        { label: 'Cảm biến', value: 'Focus Pro 30,000 DPI Optical Sensor', displayOrder: 2 },
        { label: 'Switch', value: 'Optical Mouse Switches Gen-3 (90M lần bấm, không lo double-click)', displayOrder: 3 },
        { label: 'Trọng lượng', value: '54g Siêu nhẹ', displayOrder: 4 },
      ],
    },

    {
      name: 'Nova Vertical Ergo Grip 57°',
      slug: 'nova-vertical-ergo-grip-57',
      tagline: 'Góc nghiêng vàng 57 độ tự nhiên theo tư thế bắt tay, bảo vệ khớp cổ tay',
      description:
        'Chấm dứt hoàn toàn cảm giác nhức mỏi cổ tay sau 8 tiếng làm việc. Thiết kế dáng đứng Vertical 57 độ đưa cẳng tay về tư thế bắt tay tự nhiên nhất, giải phóng 80% áp lực chèn ép lên ống cổ tay.',
      basePrice: 890000,
      originalPrice: 1100000,
      brandId: brandNova.id,
      categoryId: catMouse.id,
      thumbnailUrl: 'https://images.unsplash.com/photo-1629429408209-1f912961dbd8?w=800&auto=format&fit=crop&q=80',
      badge: 'CHĂM SÓC CỔ TAY',
      featured: false,
      isFlashSale: false,
      rating: 4.8,
      reviewCount: 145,
      images: [
        'https://images.unsplash.com/photo-1629429408209-1f912961dbd8?w=800&auto=format&fit=crop&q=80',
      ],
      skus: [
        {
          skuCode: 'NOVA-VERTICAL-CHARCOAL',
          name: 'Matte Charcoal Grip',
          colorName: 'Charcoal Grip',
          colorHex: '#2B2D33',
          price: 890000,
          originalPrice: 1100000,
          stockQuantity: 35,
          imageUrl: 'https://images.unsplash.com/photo-1629429408209-1f912961dbd8?w=800&auto=format&fit=crop&q=80',
        },
      ],
      specs: [
        { label: 'Góc công thái học', value: 'Góc nghiêng sinh trắc học 57 độ tự nhiên', displayOrder: 1 },
        { label: 'Bề mặt', value: 'Vân cao su có gờ đỡ ngón cái mềm mại', displayOrder: 2 },
        { label: 'Kết nối', value: 'Bluetooth & USB 2.4Ghz', displayOrder: 3 },
      ],
    },
  ];

  for (const item of PRODUCTS_DATA) {
    const { skus, images, specs, ...prodData } = item;

    console.log(` -> Xử lý sản phẩm: ${item.name} (${item.slug})`);

    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        ...prodData,
        basePrice: item.basePrice,
        originalPrice: item.originalPrice,
        rating: item.rating,
      },
      create: {
        ...prodData,
        basePrice: item.basePrice,
        originalPrice: item.originalPrice,
        rating: item.rating,
      },
    });

    // Cập nhật Images
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    for (let i = 0; i < images.length; i++) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          imageUrl: images[i],
          displayOrder: i,
          isThumbnail: i === 0,
        },
      });
    }

    // Cập nhật SKUs
    for (const s of skus) {
      await prisma.productSku.upsert({
        where: { skuCode: s.skuCode },
        update: {
          productId: product.id,
          name: s.name,
          colorName: s.colorName,
          colorHex: s.colorHex,
          price: s.price,
          originalPrice: s.originalPrice,
          stockQuantity: s.stockQuantity,
          imageUrl: s.imageUrl,
        },
        create: {
          productId: product.id,
          skuCode: s.skuCode,
          name: s.name,
          colorName: s.colorName,
          colorHex: s.colorHex,
          price: s.price,
          originalPrice: s.originalPrice,
          stockQuantity: s.stockQuantity,
          imageUrl: s.imageUrl,
        },
      });
    }

    // Cập nhật Specs
    await prisma.productSpec.deleteMany({ where: { productId: product.id } });
    for (const spec of specs) {
      await prisma.productSpec.create({
        data: {
          productId: product.id,
          label: spec.label,
          value: spec.value,
          displayOrder: spec.displayOrder,
        },
      });
    }
  }

  console.log('✅ Hoàn tất thêm 15 sản phẩm mới vào database product_db!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed dữ liệu mới:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
