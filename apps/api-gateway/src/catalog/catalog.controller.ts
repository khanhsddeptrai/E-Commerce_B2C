import {
  Controller,
  Get,
  Inject,
  OnModuleInit,
  Param,
  Query,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ProductServiceClient } from '@repo/proto';

@Controller('api/v1')
export class CatalogController implements OnModuleInit {
  private productServiceClient!: ProductServiceClient;

  constructor(@Inject('PRODUCT_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.productServiceClient = this.client.getService<ProductServiceClient>('ProductService');
  }

  @Get('categories')
  async getCategories() {
    const res = await firstValueFrom(this.productServiceClient.getCategories({}));
    return res.categories || [];
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
}
