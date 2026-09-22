import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import Redis from 'ioredis';
import { PrismaProductService } from '../prisma/prisma-product.service';
import { ProductPrisma } from '@repo/database';
import {
  GetProductsRequest,
  GetProductsResponse,
  GetProductBySlugRequest,
  GetProductBySlugResponse,
  GetCategoriesRequest,
  GetCategoriesResponse,
  ProductDto,
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
export class CatalogService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly prisma: PrismaProductService) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

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
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

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
    };
  }

  private async resolveSkuStocks(
    skus: ProductPrisma.ProductSku[],
  ): Promise<Map<string, number>> {
    const stockMap = new Map<string, number>();
    if (!skus || skus.length === 0) return stockMap;

    try {
      const keys = skus.map((s) => `stock:${s.id}`);
      const results = await this.redis.mget(...keys);

      const missingSkus: ProductPrisma.ProductSku[] = [];

      for (let i = 0; i < skus.length; i++) {
        const sku = skus[i];
        if (!sku) continue;
        const val = results[i];
        if (val !== null && val !== undefined) {
          stockMap.set(sku.id, Math.max(0, Number(val)));
        } else {
          stockMap.set(sku.id, sku.stockQuantity);
          missingSkus.push(sku);
        }
      }

      if (missingSkus.length > 0) {
        const pipeline = this.redis.pipeline();
        for (const sku of missingSkus) {
          pipeline.set(`stock:${sku.id}`, sku.stockQuantity);
        }
        await pipeline.exec().catch(() => {});
      }
    } catch {
      for (const sku of skus) {
        stockMap.set(sku.id, sku.stockQuantity);
      }
    }

    return stockMap;
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
            stock_quantity: liveStockMap?.get(sku.id) ?? sku.stockQuantity,
            image_url: sku.imageUrl || undefined,
            specs_json: sku.specs ? JSON.stringify(sku.specs) : '{}',
          }))
        : [],
      created_at: p.createdAt.toISOString(),
    };
  }
}
