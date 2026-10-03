import Redis from 'ioredis';
import { CatalogService } from '../../src/catalog/catalog.service';
import { InventoryService } from '../../src/inventory/inventory.service';
import { PrismaProductService } from '../../src/prisma/prisma-product.service';
import {
  createBrand,
  createCategory,
  createProduct,
  createWarehouse,
  createTestRedis,
  flushTestRedis,
  resetProductDb,
} from '../helpers';

describe('CatalogService – quản trị sản phẩm', () => {
  let prisma: PrismaProductService;
  let redis: Redis;
  let service: CatalogService;
  let inventory: InventoryService;
  let warehouseId: string;

  beforeAll(async () => {
    prisma = new PrismaProductService();
    await prisma.$connect();
    redis = createTestRedis();
    inventory = new InventoryService(prisma);
    service = new CatalogService(prisma, inventory);
  });

  beforeEach(async () => {
    await resetProductDb(prisma);
    await flushTestRedis(redis);
    warehouseId = (await createWarehouse(prisma)).id;
  });

  afterAll(async () => {
    inventory.onModuleDestroy();
    redis.disconnect();
    await prisma.$disconnect();
  });

  describe('getAdminProducts', () => {
    it('phân trang phía server và trả về tổng số bản ghi', async () => {
      const category = await createCategory(prisma);
      for (let i = 0; i < 25; i++) {
        await createProduct(prisma, { categoryId: category.id });
      }

      const res = await service.getAdminProducts({ page: 2, limit: 10 });

      expect(res.products).toHaveLength(10);
      expect(res.total).toBe(25);
      expect(res.page).toBe(2);
      expect(res.limit).toBe(10);
    });

    it('kết hợp lọc danh mục và tìm kiếm (không ghi đè điều kiện của nhau)', async () => {
      const headphones = await createCategory(prisma, 'Tai nghe');
      const keyboards = await createCategory(prisma, 'Bàn phím');
      await createProduct(prisma, { categoryId: headphones.id, name: 'Aula Pro Tai Nghe' });
      await createProduct(prisma, { categoryId: keyboards.id, name: 'Aula F75 Bàn Phím' });
      await createProduct(prisma, { categoryId: headphones.id, name: 'Sony WH-1000' });

      const res = await service.getAdminProducts({ category_id: headphones.id, search_query: 'aula' });

      expect(res.total).toBe(1);
      expect(res.products[0]?.name).toBe('Aula Pro Tai Nghe');
    });

    it('tìm kiếm theo tên thương hiệu', async () => {
      const category = await createCategory(prisma);
      const brand = await createBrand(prisma, 'NovaTech');
      await createProduct(prisma, { categoryId: category.id, brandId: brand.id, name: 'Loa Bluetooth' });
      await createProduct(prisma, { categoryId: category.id, name: 'Chuột không dây' });

      const res = await service.getAdminProducts({ search_query: 'novatech' });

      expect(res.total).toBe(1);
      expect(res.products[0]?.name).toBe('Loa Bluetooth');
    });

    it('lọc theo trạng thái', async () => {
      const category = await createCategory(prisma);
      await createProduct(prisma, { categoryId: category.id, status: 'PUBLISHED' });
      await createProduct(prisma, { categoryId: category.id, status: 'DRAFT' });
      await createProduct(prisma, { categoryId: category.id, status: 'DRAFT' });

      const res = await service.getAdminProducts({ status: 'DRAFT' });

      expect(res.total).toBe(2);
    });
  });

  describe('getAdminProductStats', () => {
    it('đếm theo trạng thái trên toàn bộ database', async () => {
      const category = await createCategory(prisma);
      await createProduct(prisma, { categoryId: category.id, status: 'PUBLISHED' });
      await createProduct(prisma, { categoryId: category.id, status: 'PUBLISHED' });
      await createProduct(prisma, { categoryId: category.id, status: 'DRAFT' });
      await createProduct(prisma, { categoryId: category.id, status: 'ARCHIVED' });

      const stats = await service.getAdminProductStats();

      expect(stats).toMatchObject({ total: 4, published: 2, draft: 1, archived: 1 });
    });

    it('tồn thấp (≤ 5) tính tổng số còn bán của mọi biến thể và ưu tiên tồn trên Redis', async () => {
      const category = await createCategory(prisma);
      // Tổng 3 → tồn thấp
      await createProduct(prisma, { categoryId: category.id, warehouseId, skus: [{ stock: 1 }, { stock: 2 }] });
      // Tổng 20 → không thấp
      await createProduct(prisma, { categoryId: category.id, warehouseId, skus: [{ stock: 10 }, { stock: 10 }] });
      // Kho còn 50 nhưng Redis chỉ còn 4 bán được → tồn thấp
      const hot = await createProduct(prisma, { categoryId: category.id, warehouseId, skus: [{ stock: 50 }] });
      await redis.set(`stock:${hot.skus[0]!.id}`, 4);

      const stats = await service.getAdminProductStats();

      expect(stats.low_stock).toBe(2);
    });
  });

});
