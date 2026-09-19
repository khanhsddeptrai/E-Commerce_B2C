const path = require('path');
const fs = require('fs');

// Nạp .env
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

const CATEGORIES = [
  {
    id: 'c1111111-1111-4111-8111-111111111111',
    name: 'Âm Thanh & Tai Nghe',
    slug: 'am-thanh-thong-minh',
    description: 'Tai nghe chống ồn chủ động ANC & Loa Bluetooth chuẩn âm thanh Hi-Res',
    icon: 'Headphones',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    displayOrder: 1,
  },
  {
    id: 'c2222222-2222-4222-8222-222222222222',
    name: 'Đồng Hồ & Wearables',
    slug: 'dong-ho-thong-minh',
    description: 'Theo dõi sức khỏe sinh trắc học, định vị GPS kép, pin bền 14 ngày',
    icon: 'Watch',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
    displayOrder: 2,
  },
  {
    id: 'c3333333-3333-4333-8333-333333333333',
    name: 'Desk Setup & Bàn Phím',
    slug: 'phu-kien-desk-setup',
    description: 'Bàn phím cơ Custom không dây, chuột công thái học, đèn thanh treo màn hình',
    icon: 'Keyboard',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
    displayOrder: 3,
  },
  {
    id: 'c4444444-4444-4444-8444-444444444444',
    name: 'Năng Lượng & Sạc Nhanh',
    slug: 'sac-nhanh-power',
    description: 'Củ sạc công nghệ GaN III 140W, Trạm sạc không dây 3-in-1, Pin dự phòng MagSafe',
    icon: 'Zap',
    imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80',
    displayOrder: 4,
  },
];

const PRODUCTS = [
  {
    categoryId: 'c1111111-1111-4111-8111-111111111111',
    name: 'Nova SoundCore Ultra ANC',
    slug: 'nova-soundcore-ultra-anc',
    tagline: 'Đỉnh cao chống ồn chủ động thích ứng với chất âm Hi-Res Lossless 96kHz',
    description: 'Tai nghe Nova SoundCore Ultra ANC trang bị bộ xử lý âm thanh kép Nova Dual-Core DSP với khả năng khử tiếng ồn môi trường thích ứng lên đến 48dB. Màng loa Titanium 40mm mang đến âm trường rộng mở, dải bass uy lực và âm cao trong trẻo. Thời lượng pin bền bỉ đến 65 giờ cùng công nghệ sạc nhanh 10 phút dùng 5 giờ.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000&auto=format&fit=crop&q=85',
    basePrice: 3490000,
    originalPrice: 4590000,
    featured: true,
    isFlashSale: true,
    flashSaleSold: 42,
    flashSaleTotal: 50,
    rating: 4.9,
    reviewCount: 148,
    badge: 'FLASH SALE',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=1000&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=1000&auto=format&fit=crop&q=85',
    ],
    specs: [
      { label: 'Màng loa', value: 'Custom Titanium Dynamic 40mm' },
      { label: 'Khử tiếng ồn', value: 'Adaptive Hybrid ANC (-48dB)' },
      { label: 'Kết nối', value: 'Bluetooth 5.4 / LDAC / AAC / Jack 3.5mm' },
      { label: 'Thời lượng pin', value: '65 giờ (Tắt ANC) / 45 giờ (Bật ANC)' },
      { label: 'Sạc nhanh', value: '10 phút sạc cho 5 giờ nghe nhạc qua Type-C' },
      { label: 'Trọng lượng', value: '248g - Đệm tai bọt biển nhớ hình siêu êm' },
      { label: 'Bảo hành', value: '24 tháng 1 đổi 1 chính hãng' },
    ],
    skus: [
      {
        skuCode: 'NV-SND-BLK',
        name: 'Space Black',
        colorName: 'Đen Vũ Trụ (Space Black)',
        colorHex: '#18181b',
        specs: { 'Màu sắc': 'Đen Vũ Trụ', 'Âm thanh': 'Hi-Res LDAC', 'Phiên bản': 'Tiêu Chuẩn' },
        price: 3490000,
        originalPrice: 4590000,
        stockQuantity: 8,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000&auto=format&fit=crop&q=85',
      },
      {
        skuCode: 'NV-SND-SLV',
        name: 'Titanium Silver',
        colorName: 'Bạc Titan (Titanium Silver)',
        colorHex: '#e4e4e7',
        specs: { 'Màu sắc': 'Bạc Titan', 'Âm thanh': 'Hi-Res LDAC', 'Phiên bản': 'Tiêu Chuẩn' },
        price: 3590000,
        originalPrice: 4690000,
        stockQuantity: 5,
        imageUrl: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=1000&auto=format&fit=crop&q=85',
      },
      {
        skuCode: 'NV-SND-BGE',
        name: 'Moonlight White',
        colorName: 'Trắng Ánh Trăng (Moonlight White)',
        colorHex: '#f4f4f5',
        specs: { 'Màu sắc': 'Trắng Ánh Trăng', 'Âm thanh': 'Hi-Res LDAC', 'Phiên bản': 'Tiêu Chuẩn' },
        price: 3590000,
        originalPrice: 4690000,
        stockQuantity: 12,
        imageUrl: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=1000&auto=format&fit=crop&q=85',
      },
    ],
  },
  {
    categoryId: 'c2222222-2222-4222-8222-222222222222',
    name: 'Nova Watch Pro 2 Titanium',
    slug: 'nova-watch-pro-2-titanium',
    tagline: 'Vỏ Titanium hàng không vũ trụ, màn hình Sapphire AMOLED 2000 nits, GPS băng tần kép',
    description: 'Nova Watch Pro 2 là người bạn đồng hành thể thao và sức khỏe đỉnh cao. Chế tác từ khung vỏ Titanium Grade 5 siêu bền và kính Sapphire chống trầy tuyệt đối. Cảm biến sinh trắc học quang học BioTracker 5.0 đo nhịp tim, nồng độ oxy trong máu SpO2, điện tâm đồ ECG và phân tích giấc ngủ chuyên sâu.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&auto=format&fit=crop&q=85',
    basePrice: 5890000,
    originalPrice: 6990000,
    featured: true,
    isFlashSale: false,
    rating: 4.8,
    reviewCount: 96,
    badge: 'MỚI RA MẮT',
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=1000&auto=format&fit=crop&q=85',
    ],
    specs: [
      { label: 'Màn hình', value: '1.43 inch AMOLED 466x466 px, Độ sáng 2000 nits' },
      { label: 'Mặt kính', value: 'Sapphire Crystal siêu cứng chống trầy xước' },
      { label: 'Vật liệu khung', value: 'Titanium Grade 5 siêu nhẹ' },
      { label: 'Định vị', value: 'GPS băng tần kép L1+L5 độc lập' },
      { label: 'Kháng nước', value: 'Chuẩn 5ATM / IP68 (Bơi lội thoải mái)' },
      { label: 'Thời lượng pin', value: '14 ngày sử dụng tiêu chuẩn, 40h GPS liên tục' },
    ],
    skus: [
      {
        skuCode: 'NV-WTC-LTH',
        name: 'Dây Da Classic',
        colorName: 'Titanium + Dây Da Bò',
        colorHex: '#78350f',
        specs: { 'Loại dây': 'Da Thật Classic', 'Kích cỡ': '46mm' },
        price: 6190000,
        originalPrice: 7290000,
        stockQuantity: 15,
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&auto=format&fit=crop&q=85',
      },
      {
        skuCode: 'NV-WTC-SPT',
        name: 'Dây Fluoroelastomer Thể Thao',
        colorName: 'Titanium Xám Đậm',
        colorHex: '#334155',
        specs: { 'Loại dây': 'Cao su thể thao thoáng khí', 'Kích cỡ': '46mm' },
        price: 5890000,
        originalPrice: 6990000,
        stockQuantity: 22,
        imageUrl: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=1000&auto=format&fit=crop&q=85',
      },
    ],
  },
  {
    categoryId: 'c3333333-3333-4333-8333-333333333333',
    name: 'Nova Apex Pro 75% Wireless Mechanical Keyboard',
    slug: 'nova-apex-pro-wireless-keyboard',
    tagline: 'Gasket Mount 5 lớp tiêu âm, Switch Pre-lubed Hot-swap, Núm vặn CNC hợp kim nhôm',
    description: 'Bàn phím cơ không dây Nova Apex Pro sở hữu layout 75% công thái học tối ưu không gian bàn làm việc. Cấu trúc Gasket Mount 5 lớp Poron Foam triệt tiêu rung động và tạo âm gõ trầm ấm. 3 chế độ kết nối (2.4GHz không độ trễ 1000Hz, Bluetooth 5.3 kết nối 3 thiết bị và Type-C cắm dây).',
    thumbnailUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1000&auto=format&fit=crop&q=85',
    basePrice: 2290000,
    originalPrice: 2890000,
    featured: true,
    isFlashSale: false,
    rating: 5.0,
    reviewCount: 312,
    badge: 'BEST SELLER',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1000&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=1000&auto=format&fit=crop&q=85',
    ],
    specs: [
      { label: 'Layout', value: '75% - 82 phím + Núm xoay Multimedia nhôm CNC' },
      { label: 'Cấu trúc', value: 'Gasket Mount 5 lớp tiêu âm cao cấp' },
      { label: 'Switch', value: 'Nova Crystal Linear (Đã Pre-lube từ nhà máy)' },
      { label: 'Hot-swap', value: 'Mạch xuôi 5 pin tương thích mọi switch' },
      { label: 'Keycap', value: 'PBT Double-shot Cherry profile chống bóng' },
      { label: 'Dung lượng pin', value: 'Pin Lithium 4000mAh dùng đến 200 giờ' },
    ],
    skus: [
      {
        skuCode: 'NV-KB-WHT',
        name: 'Retro Cream',
        colorName: 'Trắng Retro Cream',
        colorHex: '#fef3c7',
        specs: { 'Màu sắc': 'Retro Cream', 'Switch': 'Linear Êm ái' },
        price: 2290000,
        originalPrice: 2890000,
        stockQuantity: 30,
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1000&auto=format&fit=crop&q=85',
      },
      {
        skuCode: 'NV-KB-DRK',
        name: 'Cyberpunk Dark',
        colorName: 'Đen Neon Huyền Bí',
        colorHex: '#1e1b4b',
        specs: { 'Màu sắc': 'Đen Cyberpunk', 'Switch': 'Linear Êm ái' },
        price: 2390000,
        originalPrice: 2990000,
        stockQuantity: 18,
        imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=1000&auto=format&fit=crop&q=85',
      },
    ],
  },
  {
    categoryId: 'c4444444-4444-4444-8444-444444444444',
    name: 'Nova PowerMatrix 140W GaN III Multiport Charger',
    slug: 'nova-powermatrix-140w-gan-iii',
    tagline: 'Sạc nhanh PD 3.1 140W cho MacBook Pro, 4 cổng sạc đồng thời, chip tản nhiệt thông minh',
    description: 'Bộ sạc thế hệ mới ứng dụng vật liệu bán dẫn GaN III (Gallium Nitride) thu nhỏ kích thước 40% so với sạc truyền thống nhưng công suất lên tới 140W. Đầy đủ giao thức sạc nhanh PD 3.1, PPS, QC 5.0 tương thích từ Laptop, Smartphone, Tablet đến flycam.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=1000&auto=format&fit=crop&q=85',
    basePrice: 1290000,
    originalPrice: 1790000,
    featured: true,
    isFlashSale: true,
    flashSaleSold: 78,
    flashSaleTotal: 100,
    rating: 4.9,
    reviewCount: 204,
    badge: 'HOT DEAL',
    images: [
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=1000&auto=format&fit=crop&q=85',
    ],
    specs: [
      { label: 'Công suất tổng', value: '140W Max (PD 3.1 công nghệ mới)' },
      { label: 'Cổng ra', value: '3x USB-C + 1x USB-A' },
      { label: 'Phân bổ nguồn', value: 'Tự động chia dòng thông minh SmartPower AI' },
      { label: 'Trọng lượng', value: '285g (Nhỏ gọn hơn 40% sạc thường)' },
    ],
    skus: [
      {
        skuCode: 'NV-GAN-BLK',
        name: 'Matte Black',
        colorName: 'Đen Nhám Chống Trầy',
        colorHex: '#27272a',
        specs: { 'Màu sắc': 'Đen Nhám', 'Công suất': '140W GaN III' },
        price: 1290000,
        originalPrice: 1790000,
        stockQuantity: 22,
        imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=1000&auto=format&fit=crop&q=85',
      },
    ],
  },
  {
    categoryId: 'c3333333-3333-4333-8333-333333333333',
    name: 'Nova Master Ergonomic Vertical Mouse',
    slug: 'nova-master-vertical-mouse',
    tagline: 'Góc nghiêng tự nhiên 57° chống mỏi cổ tay, Cảm biến Darkfield 8000 DPI lướt trên mọi bề mặt',
    description: 'Chuột đứng công thái học Nova Master định vị tư thế tay cầm tự nhiên 57 độ, giảm 10% áp lực cơ bắp cổ tay và cánh tay. Con lăn SmartWheel siêu tốc tự động chuyển đổi giữa cuộn từng dòng và cuộn trớn vô tận. Tương thích Mac, Windows, iPadOS.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=1000&auto=format&fit=crop&q=85',
    basePrice: 1450000,
    originalPrice: 1850000,
    featured: false,
    isFlashSale: false,
    rating: 4.7,
    reviewCount: 88,
    images: [
      'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=1000&auto=format&fit=crop&q=85',
    ],
    specs: [
      { label: 'Độ phân giải', value: 'Cảm biến quang học 8000 DPI' },
      { label: 'Góc nghiêng', value: '57 độ chuẩn công thái học Ergonomics' },
      { label: 'Pin', value: 'Pin sạc Li-Po 500mAh - Dùng 70 ngày một lần sạc' },
    ],
    skus: [
      {
        skuCode: 'NV-MOU-GRP',
        name: 'Graphite',
        colorName: 'Xám Graphite',
        colorHex: '#374151',
        specs: { 'Màu sắc': 'Graphite', 'Tay cầm': 'Tay phải' },
        price: 1450000,
        originalPrice: 1850000,
        stockQuantity: 35,
        imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=1000&auto=format&fit=crop&q=85',
      },
    ],
  },
  {
    categoryId: 'c3333333-3333-4333-8333-333333333333',
    name: 'Nova LightBar Pro Smart Monitor Light',
    slug: 'nova-lightbar-pro-monitor-light',
    tagline: 'Chiếu sáng bất đối xứng bảo vệ mắt, Điều khiển từ xa không dây xoay cảm ứng, Ra > 95',
    description: 'Đèn thanh treo màn hình Nova LightBar Pro được thiết kế với chùm sáng bất đối xứng chỉ rọi xuống mặt bàn, không phản chiếu vào màn hình và không gây lóa mắt. Độ hoàn màu cao Ra > 95 tái tạo màu sắc chân thực.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517055729445-fa7d27394b48?w=1000&auto=format&fit=crop&q=85',
    basePrice: 1190000,
    originalPrice: 1490000,
    featured: false,
    isFlashSale: false,
    rating: 4.9,
    reviewCount: 165,
    images: [
      'https://images.unsplash.com/photo-1517055729445-fa7d27394b48?w=1000&auto=format&fit=crop&q=85',
    ],
    specs: [
      { label: 'Chỉ số hoàn màu', value: 'CRI Ra > 95 (Tiêu chuẩn đồ họa chuyên nghiệp)' },
      { label: 'Nhiệt độ màu', value: '2700K - 6500K (Từ vàng ấm đến trắng tự nhiên)' },
    ],
    skus: [
      {
        skuCode: 'NV-LGT-BLK',
        name: 'Space Black Aluminum',
        colorName: 'Hợp Kim Nhôm Đen',
        colorHex: '#1f2937',
        specs: { 'Vật liệu': 'Nhôm nguyên khối', 'Điều khiển': 'Remote xoay không dây' },
        price: 1190000,
        originalPrice: 1490000,
        stockQuantity: 40,
        imageUrl: 'https://images.unsplash.com/photo-1517055729445-fa7d27394b48?w=1000&auto=format&fit=crop&q=85',
      },
    ],
  },
];

async function seed() {
  console.log('🌱 [Seed] Bắt đầu nạp dữ liệu vào product_db...');

  // 1. Tạo Brand
  const brand = await prisma.brand.upsert({
    where: { slug: 'nova-tech' },
    update: {},
    create: {
      name: 'NOVA TECH',
      slug: 'nova-tech',
      logoUrl: '/images/novatech-logo.svg',
      isActive: true,
    },
  });
  console.log(`✅ [Seed] Đã tạo Brand: ${brand.name}`);

  // 2. Tạo Categories
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        imageUrl: cat.imageUrl,
        displayOrder: cat.displayOrder,
      },
      create: cat,
    });
  }
  console.log(`✅ [Seed] Đã nạp ${CATEGORIES.length} danh mục.`);

  // 3. Tạo Products
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findUnique({
      where: { slug: p.slug },
    });

    let productId;
    if (existing) {
      productId = existing.id;
      await prisma.product.update({
        where: { id: productId },
        data: {
          name: p.name,
          tagline: p.tagline,
          description: p.description,
          thumbnailUrl: p.thumbnailUrl,
          basePrice: p.basePrice,
          originalPrice: p.originalPrice,
          featured: p.featured,
          isFlashSale: p.isFlashSale,
          flashSaleSold: p.flashSaleSold || 0,
          flashSaleTotal: p.flashSaleTotal || 0,
          rating: p.rating,
          reviewCount: p.reviewCount,
          badge: p.badge,
        },
      });
    } else {
      const created = await prisma.product.create({
        data: {
          categoryId: p.categoryId,
          brandId: brand.id,
          name: p.name,
          slug: p.slug,
          tagline: p.tagline,
          description: p.description,
          thumbnailUrl: p.thumbnailUrl,
          basePrice: p.basePrice,
          originalPrice: p.originalPrice,
          featured: p.featured,
          isFlashSale: p.isFlashSale,
          flashSaleSold: p.flashSaleSold || 0,
          flashSaleTotal: p.flashSaleTotal || 0,
          rating: p.rating,
          reviewCount: p.reviewCount,
          badge: p.badge,
        },
      });
      productId = created.id;
    }

    // Xóa và tạo lại images, skus, specs
    await prisma.productImage.deleteMany({ where: { productId } });
    await prisma.productSku.deleteMany({ where: { productId } });
    await prisma.productSpec.deleteMany({ where: { productId } });

    // Tạo Images
    for (let i = 0; i < p.images.length; i++) {
      await prisma.productImage.create({
        data: {
          productId,
          imageUrl: p.images[i],
          displayOrder: i,
          isThumbnail: i === 0,
        },
      });
    }

    // Tạo SKUs
    for (const sku of p.skus) {
      await prisma.productSku.create({
        data: {
          productId,
          skuCode: sku.skuCode,
          name: sku.name,
          colorName: sku.colorName,
          colorHex: sku.colorHex,
          price: sku.price,
          originalPrice: sku.originalPrice,
          stockQuantity: sku.stockQuantity,
          imageUrl: sku.imageUrl,
          specs: sku.specs,
        },
      });
    }

    // Tạo Specs
    for (let i = 0; i < p.specs.length; i++) {
      await prisma.productSpec.create({
        data: {
          productId,
          label: p.specs[i].label,
          value: p.specs[i].value,
          displayOrder: i,
        },
      });
    }

    console.log(`✅ [Seed] Đã nạp sản phẩm: ${p.name}`);
  }

  console.log('🎉 [Seed] Hoàn tất nạp dữ liệu mẫu product_db thành công!');
}

seed()
  .catch((e) => {
    console.error('❌ [Seed] Lỗi nạp dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
