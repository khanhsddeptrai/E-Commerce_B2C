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

// Danh sách hình ảnh riêng biệt, độc nhất cho từng biến thể màu sắc
const AULA_F75_VARIANTS = [
  {
    skuCode: 'AULA-F75-GLACIER-BLUE-TTC',
    imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&auto=format&fit=crop&q=80', // Glacier Blue
  },
  {
    skuCode: 'AULA-F75-SEASALT-REAPER',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80', // Sea Salt Blue
  },
  {
    skuCode: 'AULA-F75-THUNDER-BLACK-GW',
    imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80', // Thunder Black
  },
  {
    skuCode: 'AULA-F75-CEDAR-GREEN-ICE',
    imageUrl: 'https://images.unsplash.com/photo-1541140532154-b024d705b909?w=800&auto=format&fit=crop&q=80', // Cedar Green
  },
  {
    skuCode: 'AULA-F75-GRADIENT-PURPLE-STAR',
    imageUrl: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=800&auto=format&fit=crop&q=80', // Gradient Purple
  },
];

const AULA_F87_VARIANTS = [
  {
    skuCode: 'AULA-F87-STAR-BLACK-NIMBUS',
    imageUrl: 'https://images.unsplash.com/photo-1601445638532-3c6f6c3aa1d6?w=800&auto=format&fit=crop&q=80', // Starry Black
  },
  {
    skuCode: 'AULA-F87-WHITE-GREEN-GW4',
    imageUrl: 'https://images.unsplash.com/photo-1563191911-e65f8655ebf9?w=800&auto=format&fit=crop&q=80', // White Green
  },
  {
    skuCode: 'AULA-F87-BLACK-PINK-REAPER',
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80', // Black Pink Cyberpunk
  },
  {
    skuCode: 'AULA-F87-SPACE-PURPLE-ICE',
    imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80', // Space Purple
  },
];

const AULA_F99_VARIANTS = [
  {
    skuCode: 'AULA-F99-DARK-KNIGHT-FLAME',
    imageUrl: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=800&auto=format&fit=crop&q=80', // Dark Night Realm
  },
  {
    skuCode: 'AULA-F99-SMOKY-BLUE-REAPER',
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80', // Smoky Blue Sea Mist
  },
  {
    skuCode: 'AULA-F99-STARLIT-CLOUDS-FLOWER',
    imageUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80', // Starlit Clouds
  },
  {
    skuCode: 'AULA-F99-MORANDI-GREEN-CRESCENT',
    imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80', // Morandi Forest Green
  },
];

async function updateKeyboardImages(slug, variants) {
  const product = await prisma.product.findUnique({
    where: { slug },
  });

  if (!product) {
    console.warn(`Không tìm thấy sản phẩm ${slug}`);
    return;
  }

  console.log(`\n📸 Cập nhật hình ảnh độc nhất cho sản phẩm: ${product.name}`);

  // 1. Cập nhật imageUrl cho từng SKU
  for (const v of variants) {
    await prisma.productSku.updateMany({
      where: {
        productId: product.id,
        skuCode: v.skuCode,
      },
      data: {
        imageUrl: v.imageUrl,
      },
    });
    console.log(`  -> Đã gán ảnh cho SKU: ${v.skuCode}`);
  }

  // 2. Cập nhật bảng product_images (album ảnh bộ sưu tập của sản phẩm)
  await prisma.productImage.deleteMany({
    where: { productId: product.id },
  });

  for (let i = 0; i < variants.length; i++) {
    await prisma.productImage.create({
      data: {
        productId: product.id,
        imageUrl: variants[i].imageUrl,
        displayOrder: i,
        isThumbnail: i === 0,
      },
    });
  }

  // 3. Cập nhật thumbnailUrl của sản phẩm thành ảnh của biến thể đầu tiên
  await prisma.product.update({
    where: { id: product.id },
    data: {
      thumbnailUrl: variants[0].imageUrl,
    },
  });

  console.log(`  ✅ Đã đồng bộ ${variants.length} ảnh vào bảng product_images cho ${product.name}`);
}

async function main() {
  await updateKeyboardImages('aula-f75-wireless-gasket-75', AULA_F75_VARIANTS);
  await updateKeyboardImages('aula-f87-pro-tkl-rgb-mach-xuoi', AULA_F87_VARIANTS);
  await updateKeyboardImages('aula-f99-pro-3-mode-gasket-mount', AULA_F99_VARIANTS);
  console.log('\n🎉 Hoàn tất cập nhật 100% hình ảnh riêng biệt cho tất cả các biến thể AULA!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
