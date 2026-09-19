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
}
