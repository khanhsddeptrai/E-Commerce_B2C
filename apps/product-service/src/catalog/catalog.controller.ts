import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CatalogService } from './catalog.service';
import {
  GetProductsRequest,
  GetProductsResponse,
  GetProductBySlugRequest,
  GetProductBySlugResponse,
  GetCategoriesRequest,
  GetCategoriesResponse,
  GetAdminProductsRequest,
  GetAdminProductsResponse,
  CreateProductRequest,
  UpdateProductRequest,
  UpdateProductStatusRequest,
  UpdateSkuStockRequest,
  ProductDto,
  ProductSkuDto,
  GetBrandsRequest,
  GetBrandsResponse,
} from '@repo/proto';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @GrpcMethod('ProductService', 'GetProducts')
  async getProducts(data: GetProductsRequest): Promise<GetProductsResponse> {
    return this.catalogService.getProducts(data);
  }

  @GrpcMethod('ProductService', 'GetProductBySlug')
  async getProductBySlug(data: GetProductBySlugRequest): Promise<GetProductBySlugResponse> {
    return this.catalogService.getProductBySlug(data);
  }

  @GrpcMethod('ProductService', 'GetCategories')
  async getCategories(data: GetCategoriesRequest): Promise<GetCategoriesResponse> {
    return this.catalogService.getCategories(data);
  }

  @GrpcMethod('ProductService', 'GetAdminProducts')
  async getAdminProducts(data: GetAdminProductsRequest): Promise<GetAdminProductsResponse> {
    return this.catalogService.getAdminProducts(data);
  }

  @GrpcMethod('ProductService', 'GetBrands')
  async getBrands(data: GetBrandsRequest): Promise<GetBrandsResponse> {
    return this.catalogService.getBrands(data);
  }

  @GrpcMethod('ProductService', 'CreateProduct')
  async createProduct(data: CreateProductRequest): Promise<ProductDto> {
    return this.catalogService.createProduct(data);
  }

  @GrpcMethod('ProductService', 'UpdateProduct')
  async updateProduct(data: UpdateProductRequest): Promise<ProductDto> {
    return this.catalogService.updateProduct(data);
  }

  @GrpcMethod('ProductService', 'UpdateProductStatus')
  async updateProductStatus(data: UpdateProductStatusRequest): Promise<ProductDto> {
    return this.catalogService.updateProductStatus(data);
  }

  @GrpcMethod('ProductService', 'UpdateSkuStock')
  async updateSkuStock(data: UpdateSkuStockRequest): Promise<ProductSkuDto> {
    return this.catalogService.updateSkuStock(data);
  }
}
