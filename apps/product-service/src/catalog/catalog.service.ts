import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { PrismaProductService } from '../prisma/prisma-product.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductPrisma } from '@repo/database';
import {
  GetProductsRequest,
  GetProductsResponse,
  GetProductBySlugRequest,
  GetProductBySlugResponse,
  GetCategoriesRequest,
  GetCategoriesResponse,
  ProductDto,
  ProductSkuDto,
  GetAdminProductsRequest,
  GetAdminProductsResponse,
  GetAdminProductStatsResponse,
  CreateProductRequest,
  UpdateProductRequest,
  UpdateProductStatusRequest,
  UpdateSkuStockRequest,
  GetBrandsRequest,
  GetBrandsResponse,
} from '@repo/proto';

interface ExtendedGetProductsRequest extends GetProductsRequest {
  categorySlug?: string;
  searchQuery?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  featuredOnly?: boolean;
  flashSaleOnly?: boolean;
}

type ProductWithRelations = ProductPrisma.Prisma.ProductGetPayload<{
  include: {
    category: true;
    brand: true;
    images: { orderBy: { displayOrder: 'asc' } };
    skus: { where: { isActive: true } };
    specs: { orderBy: { displayOrder: 'asc' } };
  };
}>;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaProductService,
    private readonly inventory: InventoryService,
  ) {}

  async getProducts(data: GetProductsRequest): Promise<GetProductsResponse> {
    const page = Math.max(1, Number(data.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(data.limit) || 20));
    const skip = (page - 1) * limit;

    const where: ProductPrisma.Prisma.ProductWhereInput = {
      status: 'PUBLISHED',
    };

    const extData = data as ExtendedGetProductsRequest;
    const categorySlug = data.category_slug || extData.categorySlug;
    if (categorySlug && categorySlug !== 'all') {
      where.category = {
        OR: [
          { slug: categorySlug },
          { id: categorySlug },
        ],
      };
    }

    const searchQuery = data.search_query || extData.searchQuery;
    if (searchQuery) {
      const q = searchQuery.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { tagline: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const minPrice = data.min_price ?? extData.minPrice;
    if (minPrice !== undefined && minPrice !== null) {
      where.basePrice = { ...((where.basePrice as ProductPrisma.Prisma.DecimalFilter) || {}), gte: Number(minPrice) };
    }

    const maxPrice = data.max_price ?? extData.maxPrice;
    if (maxPrice !== undefined && maxPrice !== null) {
      where.basePrice = { ...((where.basePrice as ProductPrisma.Prisma.DecimalFilter) || {}), lte: Number(maxPrice) };
    }

    const featuredOnly = data.featured_only ?? extData.featuredOnly;
    if (featuredOnly) {
      where.featured = true;
    }

    const flashSaleOnly = data.flash_sale_only ?? extData.flashSaleOnly;
    if (flashSaleOnly) {
      where.isFlashSale = true;
    }

    let orderBy:
      | ProductPrisma.Prisma.ProductOrderByWithRelationInput
      | ProductPrisma.Prisma.ProductOrderByWithRelationInput[] = [
      { featured: 'desc' },
      { createdAt: 'desc' },
    ];
    const sortBy = data.sort_by || extData.sortBy;
    if (sortBy) {
      switch (sortBy) {
        case 'price-asc':
          orderBy = { basePrice: 'asc' };
          break;
        case 'price-desc':
          orderBy = { basePrice: 'desc' };
          break;
        case 'rating':
          orderBy = { rating: 'desc' };
          break;
        case 'newest':
          orderBy = { createdAt: 'desc' };
          break;
        case 'featured':
        default:
          orderBy = [{ featured: 'desc' }, { createdAt: 'desc' }];
          break;
      }
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: true,
          brand: true,
          images: { orderBy: { displayOrder: 'asc' } },
          skus: { where: { isActive: true } },
          specs: { orderBy: { displayOrder: 'asc' } },
        },
      }),
    ]);

    const allSkus = products.flatMap((p) => p.skus || []);
    const liveStockMap = await this.resolveSkuStocks(allSkus);

    return {
      products: products.map((p) => this.mapProductToDto(p, liveStockMap)),
      total,
      page,
      limit,
    };
  }

  async getProductBySlug(data: GetProductBySlugRequest): Promise<GetProductBySlugResponse> {
    const slug = data.slug?.trim();
    if (!slug) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Slug sản phẩm không được để trống',
      });
    }

    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        brand: true,
        images: { orderBy: { displayOrder: 'asc' } },
        skus: { where: { isActive: true } },
        specs: { orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!product) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Không tìm thấy sản phẩm với slug: ${slug}`,
      });
    }

    const liveStockMap = await this.resolveSkuStocks(product.skus || []);

    return {
      product: this.mapProductToDto(product, liveStockMap),
    };
  }

  async getCategories(data: GetCategoriesRequest): Promise<GetCategoriesResponse> {
    const page = Math.max(1, Number(data.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(data.limit) || 50));
    const skip = (page - 1) * limit;

    const where = { isActive: true };

    const [total, categories] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: { displayOrder: 'asc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
    ]);

    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description || undefined,
        icon: c.icon || undefined,
        image_url: c.imageUrl || undefined,
        item_count: c._count.products,
      })),
      total,
      page,
      limit,
    };
  }

  async getAdminProducts(data: GetAdminProductsRequest): Promise<GetAdminProductsResponse> {
    const page = Math.max(1, Number(data.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(data.limit) || 20));
    const skip = (page - 1) * limit;

    const where: ProductPrisma.Prisma.ProductWhereInput = {};
    // Gom các điều kiện OR vào AND để lọc danh mục và tìm kiếm không ghi đè lẫn nhau
    const conditions: ProductPrisma.Prisma.ProductWhereInput[] = [];

    if (data.status && data.status !== 'ALL') {
      where.status = data.status as ProductPrisma.ProductStatus;
    }

    if (data.category_id && data.category_id !== 'all') {
      conditions.push({
        OR: [
          { categoryId: data.category_id },
          { category: { slug: data.category_id } },
        ],
      });
    }

    if (data.search_query && data.search_query.trim()) {
      const q = data.search_query.trim();
      conditions.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { tagline: { contains: q, mode: 'insensitive' } },
          { brand: { name: { contains: q, mode: 'insensitive' } } },
          { skus: { some: { skuCode: { contains: q, mode: 'insensitive' } } } },
        ],
      });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          category: true,
          brand: true,
          images: { orderBy: { displayOrder: 'asc' } },
          skus: true,
          specs: { orderBy: { displayOrder: 'asc' } },
        },
      }),
    ]);

    const allSkus = products.flatMap((p) => p.skus || []);
    const liveStockMap = await this.resolveSkuStocks(allSkus);

    return {
      products: products.map((p) => this.mapProductToDto(p, liveStockMap)),
      total,
      page,
      limit,
    };
  }

  async getAdminProductStats(): Promise<GetAdminProductStatsResponse> {
    const LOW_STOCK_THRESHOLD = 5;

    const [total, published, draft, archived, skus, productIds] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.product.count({ where: { status: 'DRAFT' } }),
      this.prisma.product.count({ where: { status: 'ARCHIVED' } }),
      this.prisma.productSku.findMany(),
      this.prisma.product.findMany({ select: { id: true } }),
    ]);

    // Tính tồn theo cùng nguồn với bảng danh sách (số còn bán được từ InventoryService)
    const liveStockMap = await this.resolveSkuStocks(skus);
    const stockByProduct = new Map<string, number>();
    for (const sku of skus) {
      const stock = liveStockMap.get(sku.id) ?? 0;
      stockByProduct.set(sku.productId, (stockByProduct.get(sku.productId) ?? 0) + stock);
    }

    const lowStock = productIds.filter(
      (p) => (stockByProduct.get(p.id) ?? 0) <= LOW_STOCK_THRESHOLD,
    ).length;

    return {
      total,
      published,
      draft,
      archived,
      low_stock: lowStock,
    };
  }

  async getBrands(data: GetBrandsRequest): Promise<GetBrandsResponse> {
    const page = Math.max(1, Number(data.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(data.limit) || 50));
    const skip = (page - 1) * limit;

    const where = { isActive: true };

    const [total, brands] = await Promise.all([
      this.prisma.brand.count({ where }),
      this.prisma.brand.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      brands: brands.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        logo_url: b.logoUrl || undefined,
      })),
      total,
      page,
      limit,
    };
  }

  async createProduct(data: CreateProductRequest): Promise<ProductDto> {
    const rawSlug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const slug = `${rawSlug}-${Math.random().toString(36).substring(2, 6)}`;
    // Tồn ban đầu của biến thể được nhập vào kho mặc định (inventory_stocks + sổ kho INBOUND tồn đầu kỳ)
    const warehouseId = await this.inventory.getDefaultWarehouseId();
    const initialStockByCode = new Map((data.variants || []).map((v) => [v.sku_code, v.stock_quantity || 0]));

    const created = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: data.name,
          slug,
          categoryId: data.category_id,
          brandId: data.brand_id || null,
          tagline: data.tagline || null,
          description: data.description || '',
          thumbnailUrl: data.thumbnail_url,
          basePrice: data.base_price,
          originalPrice: data.original_price ?? null,
          featured: data.featured || false,
          isFlashSale: data.is_flash_sale || false,
          badge: data.badge || null,
          status: (data.status as ProductPrisma.ProductStatus) || 'PUBLISHED',
          images: {
            create: (data.images || []).map((url, idx) => ({
              imageUrl: url,
              displayOrder: idx,
              isThumbnail: idx === 0,
            })),
          },
          specs: {
            create: (data.specs || []).map((s, idx) => ({
              label: s.label,
              value: s.value,
              displayOrder: idx,
            })),
          },
          skus: {
            create: (data.variants || []).map((v) => ({
              skuCode: v.sku_code,
              name: v.name,
              colorName: v.color_name,
              colorHex: v.color_hex,
              price: v.price,
              originalPrice: v.original_price ?? null,
              imageUrl: v.image_url || null,
              specs: v.specs_json ? JSON.parse(v.specs_json) : {},
              isActive: true,
            })),
          },
        },
        include: {
          category: true,
          brand: true,
          images: { orderBy: { displayOrder: 'asc' } },
          skus: true,
          specs: { orderBy: { displayOrder: 'asc' } },
        },
      });

      await this.inventory.initializeSkuStocks(
        tx,
        warehouseId,
        product.skus.map((s) => ({ id: s.id, quantity: initialStockByCode.get(s.skuCode) ?? 0 })),
        `PRODUCT:${product.id}`,
        'ADMIN',
      );

      return product;
    });

    // Key Redis stock:{skuId} được khởi tạo từ database ở lần đọc đầu tiên
    const liveStockMap = await this.resolveSkuStocks(created.skus || []);
    return this.mapProductToDto(created, liveStockMap);
  }

  async updateProduct(data: UpdateProductRequest): Promise<ProductDto> {
    const existing = await this.prisma.product.findUnique({
      where: { id: data.id },
    });

    if (!existing) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Không tìm thấy sản phẩm với id: ${data.id}`,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (data.specs && data.specs.length > 0) {
        await tx.productSpec.deleteMany({ where: { productId: data.id } });
        await tx.productSpec.createMany({
          data: data.specs.map((s, idx) => ({
            productId: data.id,
            label: s.label,
            value: s.value,
            displayOrder: idx,
          })),
        });
      }

      if (data.images && data.images.length > 0) {
        await tx.productImage.deleteMany({ where: { productId: data.id } });
        await tx.productImage.createMany({
          data: data.images.map((url, idx) => ({
            productId: data.id,
            imageUrl: url,
            displayOrder: idx,
            isThumbnail: idx === 0,
          })),
        });
      }

      return tx.product.update({
        where: { id: data.id },
        data: {
          name: data.name,
          slug: data.slug || existing.slug,
          categoryId: data.category_id,
          brandId: data.brand_id || null,
          tagline: data.tagline || null,
          description: data.description,
          thumbnailUrl: data.thumbnail_url,
          basePrice: data.base_price,
          originalPrice: data.original_price ?? null,
          featured: data.featured,
          isFlashSale: data.is_flash_sale,
          badge: data.badge || null,
          status: (data.status as ProductPrisma.ProductStatus) || existing.status,
        },
        include: {
          category: true,
          brand: true,
          images: { orderBy: { displayOrder: 'asc' } },
          skus: true,
          specs: { orderBy: { displayOrder: 'asc' } },
        },
      });
    });

    const liveStockMap = await this.resolveSkuStocks(updated.skus || []);
    return this.mapProductToDto(updated, liveStockMap);
  }

  async updateProductStatus(data: UpdateProductStatusRequest): Promise<ProductDto> {
    const updated = await this.prisma.product.update({
      where: { id: data.id },
      data: {
        status: data.status as ProductPrisma.ProductStatus,
      },
      include: {
        category: true,
        brand: true,
        images: { orderBy: { displayOrder: 'asc' } },
        skus: true,
        specs: { orderBy: { displayOrder: 'asc' } },
      },
    });

    const liveStockMap = await this.resolveSkuStocks(updated.skus || []);
    return this.mapProductToDto(updated, liveStockMap);
  }

  /**
   * Admin sửa nhanh: stock_quantity là tồn thực tế mới tại kho mặc định — ghi phiếu điều chỉnh phần chênh lệch
   * (không ghi đè Redis nên không mất phần đang giữ / đã chốt). Trả về stock_quantity = số còn bán được.
   */
  async updateSkuStock(data: UpdateSkuStockRequest): Promise<ProductSkuDto> {
    await this.inventory.setOnHand(
      data.sku_id,
      data.stock_quantity,
      data.updated_by || 'ADMIN',
      'Admin cập nhật nhanh tồn kho',
    );

    const sku =
      data.price !== undefined && data.price !== null
        ? await this.prisma.productSku.update({ where: { id: data.sku_id }, data: { price: data.price } })
        : await this.prisma.productSku.findUniqueOrThrow({ where: { id: data.sku_id } });
    const available = (await this.inventory.getAvailableStocks([sku.id])).get(sku.id) ?? 0;

    return {
      id: sku.id,
      sku_code: sku.skuCode,
      name: sku.name,
      color_name: sku.colorName,
      color_hex: sku.colorHex,
      price: Number(sku.price),
      original_price: sku.originalPrice ? Number(sku.originalPrice) : undefined,
      stock_quantity: available,
      image_url: sku.imageUrl || undefined,
      specs_json: sku.specs ? JSON.stringify(sku.specs) : '{}',
    };
  }

  /** Số còn bán được của các SKU (Redis, khởi tạo / dự phòng từ inventory_stocks) */
  private resolveSkuStocks(skus: ProductPrisma.ProductSku[]): Promise<Map<string, number>> {
    return this.inventory.getAvailableStocks(skus.map((s) => s.id));
  }

  private mapProductToDto(
    p: ProductWithRelations,
    liveStockMap?: Map<string, number>,
  ): ProductDto {
    return {
      id: p.id,
      category_id: p.categoryId,
      category_name: p.category?.name || '',
      category_slug: p.category?.slug || '',
      brand: p.brand?.name || 'NOVA TECH',
      name: p.name,
      slug: p.slug,
      tagline: p.tagline || undefined,
      description: p.description,
      thumbnail_url: p.thumbnailUrl,
      base_price: Number(p.basePrice),
      original_price: p.originalPrice ? Number(p.originalPrice) : undefined,
      featured: Boolean(p.featured),
      is_flash_sale: Boolean(p.isFlashSale),
      flash_sale_sold: p.flashSaleSold || 0,
      flash_sale_total: p.flashSaleTotal || 0,
      rating: Number(p.rating),
      review_count: p.reviewCount || 0,
      badge: p.badge || undefined,
      images: p.images ? p.images.map((img: ProductPrisma.ProductImage) => img.imageUrl) : [],
      specs: p.specs
        ? p.specs.map((s: ProductPrisma.ProductSpec) => ({
            label: s.label,
            value: s.value,
          }))
        : [],
      variants: p.skus
        ? p.skus.map((sku: ProductPrisma.ProductSku) => ({
            id: sku.id,
            sku_code: sku.skuCode,
            name: sku.name,
            color_name: sku.colorName,
            color_hex: sku.colorHex,
            price: Number(sku.price),
            original_price: sku.originalPrice ? Number(sku.originalPrice) : undefined,
            stock_quantity: liveStockMap?.get(sku.id) ?? 0,
            image_url: sku.imageUrl || undefined,
            specs_json: sku.specs ? JSON.stringify(sku.specs) : '{}',
          }))
        : [],
      created_at: p.createdAt.toISOString(),
      status: p.status,
    };
  }
}
