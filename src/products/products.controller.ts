import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CompanyMatchGuard, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCompany } from '../common/decorators/current-company.decorator';
import { Company } from '../companies/entities/company.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';
import {
  ProductListResponse,
  ProductResponse,
} from './types/product-response.types';

@Controller('products')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @CurrentCompany() company: Company,
    @Query() query: ListProductsQueryDto,
  ): Promise<ProductListResponse> {
    return this.productsService.findAll(company.id, query);
  }

  @Get(':id')
  findOne(
    @CurrentCompany() company: Company,
    @Param('id') id: string,
  ): Promise<ProductResponse> {
    return this.productsService.findById(company.id, id);
  }

  @Post()
  create(
    @CurrentCompany() company: Company,
    @Body() dto: CreateProductDto,
  ): Promise<ProductResponse> {
    return this.productsService.create(company.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentCompany() company: Company,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    return this.productsService.update(company.id, id, dto);
  }
}
