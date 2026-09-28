import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  OnModuleInit,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { ProductServiceClient } from '@repo/proto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateProductDto,
  UpdateProductDto,
  UpdateProductStatusDto,
  UpdateSkuStockDto,
} from './dto/admin-product.dto';

interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Controller('api/v1')
export class CatalogController implements OnModuleInit {
  private productServiceClient!: ProductServiceClient;

  constructor(@Inject('PRODUCT_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.productServiceClient = this.client.getService<ProductServiceClient>('ProductService');
  }

  @Get('categories')
  async getCategories(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const res = await firstValueFrom(
      this.productServiceClient.getCategories({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
      }),
    );
    return {
      categories: res.categories || [],
      total: res.total ?? (res.categories || []).length,
      page: res.page ?? 1,
      limit: res.limit ?? 50,
    };
  }

  @Get('brands')
  async getBrands(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const res = await firstValueFrom(
      this.productServiceClient.getBrands({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
      }),
    );
    return {
      brands: res.brands || [],
      total: res.total ?? (res.brands || []).length,
      page: res.page ?? 1,
      limit: res.limit ?? 50,
    };
  }

  @Get('products')
  async getProducts(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('featured') featured?: string,
    @Query('flashSale') flashSale?: string,
  ) {
    const res = await firstValueFrom(
      this.productServiceClient.getProducts({
        category_slug: category,
        search_query: search,
        min_price: minPrice ? Number(minPrice) : undefined,
        max_price: maxPrice ? Number(maxPrice) : undefined,
        sort_by: sortBy,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        featured_only: featured === 'true',
        flash_sale_only: flashSale === 'true',
      }),
    );
    return res;
  }

  @Get('products/:slug')
  async getProductBySlug(@Param('slug') slug: string) {
    const res = await firstValueFrom(this.productServiceClient.getProductBySlug({ slug }));
    return res.product;
  }

  // --- ADMIN ENDPOINTS ---

  @Get('admin/products')
  @UseGuards(JwtAuthGuard)
  async getAdminProducts(
    @Req() req: RequestWithUser,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ có quản trị viên (ADMIN) mới có quyền truy cập quản lý sản phẩm');
    }

    const res = await firstValueFrom(
      this.productServiceClient.getAdminProducts({
        category_id: category,
        search_query: search,
        status: status,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      }),
    );
    return res;
  }

  @Post('admin/products')
  @UseGuards(JwtAuthGuard)
  async createProduct(
    @Req() req: RequestWithUser,
    @Body() dto: CreateProductDto,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ có quản trị viên (ADMIN) mới có quyền tạo sản phẩm mới');
    }

    const res = await firstValueFrom(
      this.productServiceClient.createProduct({
        name: dto.name,
        slug: dto.slug || '',
        category_id: dto.category_id,
        brand_id: dto.brand_id,
        tagline: dto.tagline,
        description: dto.description,
        thumbnail_url: dto.thumbnail_url,
        base_price: dto.base_price,
        original_price: dto.original_price,
        featured: dto.featured || false,
        is_flash_sale: dto.is_flash_sale || false,
        badge: dto.badge,
        status: dto.status || 'PUBLISHED',
        images: dto.images || [],
        specs: (dto.specs || []).map((s) => ({ label: s.label, value: s.value })),
        variants: (dto.variants || []).map((v) => ({
          sku_code: v.sku_code,
          name: v.name,
          color_name: v.color_name,
          color_hex: v.color_hex,
          price: v.price,
          original_price: v.original_price,
          stock_quantity: v.stock_quantity,
          image_url: v.image_url,
          specs_json: v.specs_json,
        })),
      }),
    );
    return res;
  }

  @Put('admin/products/:id')
  @UseGuards(JwtAuthGuard)
  async updateProduct(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ có quản trị viên (ADMIN) mới có quyền cập nhật sản phẩm');
    }

    const res = await firstValueFrom(
      this.productServiceClient.updateProduct({
        id,
        name: dto.name,
        slug: dto.slug || '',
        category_id: dto.category_id,
        brand_id: dto.brand_id,
        tagline: dto.tagline,
        description: dto.description,
        thumbnail_url: dto.thumbnail_url,
        base_price: dto.base_price,
        original_price: dto.original_price,
        featured: dto.featured || false,
        is_flash_sale: dto.is_flash_sale || false,
        badge: dto.badge,
        status: dto.status || 'PUBLISHED',
        images: dto.images || [],
        specs: (dto.specs || []).map((s) => ({ label: s.label, value: s.value })),
      }),
    );
    return res;
  }

  @Patch('admin/products/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateProductStatus(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ có quản trị viên (ADMIN) mới có quyền đổi trạng thái sản phẩm');
    }

    const res = await firstValueFrom(
      this.productServiceClient.updateProductStatus({
        id,
        status: dto.status,
      }),
    );
    return res;
  }

  @Patch('admin/products/skus/:skuId/stock')
  @UseGuards(JwtAuthGuard)
  async updateSkuStock(
    @Req() req: RequestWithUser,
    @Param('skuId') skuId: string,
    @Body() dto: UpdateSkuStockDto,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ có quản trị viên (ADMIN) mới có quyền chỉnh sửa tồn kho');
    }

    const res = await firstValueFrom(
      this.productServiceClient.updateSkuStock({
        sku_id: skuId,
        stock_quantity: dto.stock_quantity,
        price: dto.price,
      }),
    );
    return res;
  }
}
