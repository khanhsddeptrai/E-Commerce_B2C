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
  console.log('🚀 Đang bổ sung đầy đủ các biến thể màu sắc & switch chuẩn quốc tế cho bàn phím AULA...');

  // =========================================================================
  // 1. AULA F75 Wireless Gasket 75%
  // =========================================================================
  const f75 = await prisma.product.findUnique({
    where: { slug: 'aula-f75-wireless-gasket-75' },
  });

  if (f75) {
    const f75Skus = [
      {
        skuCode: 'AULA-F75-GLACIER-BLUE-TTC',
        name: 'Glacier Blue (TTC Iron Linear)',
        colorName: 'Glacier Blue',
        colorHex: '#6BA4B8',
        price: 1290000,
        originalPrice: 1590000,
        stockQuantity: 45,
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'TTC Iron Linear (42g)', sound: 'Thocky & Clacky', led: 'RGB South-Facing' },
      },
      {
        skuCode: 'AULA-F75-SEASALT-REAPER',
        name: 'Sea Salt Blue (LEOBOG Reaper Switch)',
        colorName: 'Sea Salt Blue',
        colorHex: '#8CA9C4',
        price: 1350000,
        originalPrice: 1650000,
        stockQuantity: 35,
        imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'LEOBOG Reaper Linear (45g)', sound: 'Thocky Marbled Sound', led: 'RGB South-Facing' },
      },
      {
        skuCode: 'AULA-F75-THUNDER-BLACK-GW',
        name: 'Thunder Black (LEOBOG Graywood V3)',
        colorName: 'Thunder Black',
        colorHex: '#2B2D31',
        price: 1250000,
        originalPrice: 1550000,
        stockQuantity: 50,
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'LEOBOG Graywood V3 (40g)', sound: 'Creamy Smooth', led: 'RGB South-Facing' },
      },
      {
        skuCode: 'AULA-F75-CEDAR-GREEN-ICE',
        name: 'Cedar Green (LEOBOG Ice Vein Switch)',
        colorName: 'Cedar Green',
        colorHex: '#506B5B',
        price: 1390000,
        originalPrice: 1690000,
        stockQuantity: 28,
        imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'LEOBOG Ice Vein (38g)', sound: 'Ultra Smooth Clean', led: 'RGB South-Facing' },
      },
      {
        skuCode: 'AULA-F75-GRADIENT-PURPLE-STAR',
        name: 'Gradient Purple Side-Printed (Star Vector Switch)',
        colorName: 'Gradient Purple',
        colorHex: '#7E57C2',
        price: 1450000,
        originalPrice: 1750000,
        stockQuantity: 22,
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'Star Vector Linear', sound: 'Creamy Deep', keycap: 'Side-Printed Gradient PBT' },
      },
    ];

    for (const s of f75Skus) {
      await prisma.productSku.upsert({
        where: { skuCode: s.skuCode },
        update: {
          productId: f75.id,
          name: s.name,
          colorName: s.colorName,
          colorHex: s.colorHex,
          price: s.price,
          originalPrice: s.originalPrice,
          stockQuantity: s.stockQuantity,
          imageUrl: s.imageUrl,
          specs: s.specs,
        },
        create: {
          productId: f75.id,
          skuCode: s.skuCode,
          name: s.name,
          colorName: s.colorName,
          colorHex: s.colorHex,
          price: s.price,
          originalPrice: s.originalPrice,
          stockQuantity: s.stockQuantity,
          imageUrl: s.imageUrl,
          specs: s.specs,
        },
      });
    }
    console.log(` -> Đã thêm 5 biến thể màu & switch cho AULA F75!`);
  }

  // =========================================================================
  // 2. AULA F87 Pro TKL RGB Mạch Xuôi
  // =========================================================================
  const f87 = await prisma.product.findUnique({
    where: { slug: 'aula-f87-pro-tkl-rgb-mach-xuoi' },
  });

  if (f87) {
    const f87Skus = [
      {
        skuCode: 'AULA-F87-STAR-BLACK-NIMBUS',
        name: 'Starry Black (LEOBOG Nimbus V3)',
        colorName: 'Starry Black',
        colorHex: '#1E232A',
        price: 1150000,
        originalPrice: 1390000,
        stockQuantity: 35,
        imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'LEOBOG Nimbus V3 Linear (35g)', sound: 'Smooth Light' },
      },
      {
        skuCode: 'AULA-F87-WHITE-GREEN-GW4',
        name: 'White Green Gradient (LEOBOG Greywood V4)',
        colorName: 'White Green Gradient',
        colorHex: '#4E8752',
        price: 1190000,
        originalPrice: 1450000,
        stockQuantity: 40,
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'LEOBOG Greywood V4 Linear', sound: 'Crisp Clacky' },
      },
      {
        skuCode: 'AULA-F87-BLACK-PINK-REAPER',
        name: 'Black Pink Cyberpunk (LEOBOG Reaper Switch)',
        colorName: 'Black Pink Cyber',
        colorHex: '#E91E63',
        price: 1250000,
        originalPrice: 1490000,
        stockQuantity: 30,
        imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'LEOBOG Reaper Linear (45g)', sound: 'Deep Thocky' },
      },
      {
        skuCode: 'AULA-F87-SPACE-PURPLE-ICE',
        name: 'Space Nebula Purple (LEOBOG Ice Vein Switch)',
        colorName: 'Space Purple',
        colorHex: '#5E35B1',
        price: 1290000,
        originalPrice: 1550000,
        stockQuantity: 25,
        imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'LEOBOG Ice Vein Ultra Light (38g)', sound: 'Silent-Like Smooth' },
      },
    ];

    for (const s of f87Skus) {
      await prisma.productSku.upsert({
        where: { skuCode: s.skuCode },
        update: {
          productId: f87.id,
          name: s.name,
          colorName: s.colorName,
          colorHex: s.colorHex,
          price: s.price,
          originalPrice: s.originalPrice,
          stockQuantity: s.stockQuantity,
          imageUrl: s.imageUrl,
          specs: s.specs,
        },
        create: {
          productId: f87.id,
          skuCode: s.skuCode,
          name: s.name,
          colorName: s.colorName,
          colorHex: s.colorHex,
          price: s.price,
          originalPrice: s.originalPrice,
          stockQuantity: s.stockQuantity,
          imageUrl: s.imageUrl,
          specs: s.specs,
        },
      });
    }
    console.log(` -> Đã thêm 4 biến thể màu & switch cho AULA F87 Pro!`);
  }

  // =========================================================================
  // 3. AULA F99 Pro 3-Mode Gasket Mount
  // =========================================================================
  const f99 = await prisma.product.findUnique({
    where: { slug: 'aula-f99-pro-3-mode-gasket-mount' },
  });

  if (f99) {
    const f99Skus = [
      {
        skuCode: 'AULA-F99-DARK-KNIGHT-FLAME',
        name: 'Dark Night Realm (TTC Flame Purple)',
        colorName: 'Dark Night Realm',
        colorHex: '#26292E',
        price: 1590000,
        originalPrice: 1890000,
        stockQuantity: 28,
        imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'TTC Flame Purple V2', sound: 'Solid Marbled Thock', battery: '8000mAh' },
      },
      {
        skuCode: 'AULA-F99-SMOKY-BLUE-REAPER',
        name: 'Smoky Blue Sea Mist (LEOBOG Reaper Switch)',
        colorName: 'Smoky Blue',
        colorHex: '#607D8B',
        price: 1650000,
        originalPrice: 1950000,
        stockQuantity: 32,
        imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'LEOBOG Reaper Linear (45g)', sound: 'Deep Bass Thocky', battery: '8000mAh' },
      },
      {
        skuCode: 'AULA-F99-STARLIT-CLOUDS-FLOWER',
        name: 'Starlit Clouds (Flower Field Linear Switch)',
        colorName: 'Starlit Clouds',
        colorHex: '#ECEFF1',
        price: 1690000,
        originalPrice: 1990000,
        stockQuantity: 20,
        imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'Flower Field Linear (42g)', sound: 'Creamy Sound', battery: '8000mAh' },
      },
      {
        skuCode: 'AULA-F99-MORANDI-GREEN-CRESCENT',
        name: 'Morandi Forest Green (AULA Crescent Switch)',
        colorName: 'Morandi Green',
        colorHex: '#5F7161',
        price: 1620000,
        originalPrice: 1920000,
        stockQuantity: 24,
        imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80',
        specs: { switch: 'AULA Crescent Linear (40g)', sound: 'Smooth Clean', battery: '8000mAh' },
      },
    ];

    for (const s of f99Skus) {
      await prisma.productSku.upsert({
        where: { skuCode: s.skuCode },
        update: {
          productId: f99.id,
          name: s.name,
          colorName: s.colorName,
          colorHex: s.colorHex,
          price: s.price,
          originalPrice: s.originalPrice,
          stockQuantity: s.stockQuantity,
          imageUrl: s.imageUrl,
          specs: s.specs,
        },
        create: {
          productId: f99.id,
          skuCode: s.skuCode,
          name: s.name,
          colorName: s.colorName,
          colorHex: s.colorHex,
          price: s.price,
          originalPrice: s.originalPrice,
          stockQuantity: s.stockQuantity,
          imageUrl: s.imageUrl,
          specs: s.specs,
        },
      });
    }
    console.log(` -> Đã thêm 4 biến thể màu & switch cho AULA F99!`);
  }

  console.log('✅ Hoàn tất bổ sung toàn bộ biến thể chính hãng cho bàn phím AULA!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
