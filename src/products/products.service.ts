import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { toProductResponse } from './product.mapper';
import {
  ProductListResponse,
  ProductResponse,
} from './types/product-response.types';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(
    companyId: string,
    query: ListProductsQueryDto,
  ): Promise<ProductListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.productRepository
      .createQueryBuilder('p')
      .where('p.companyId = :companyId', { companyId });

    if (query.isActive !== undefined) {
      qb.andWhere('p.isActive = :isActive', { isActive: query.isActive });
    }

    if (query.q) {
      qb.andWhere('(p.code ILIKE :q OR p.description ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }

    qb.orderBy('p.description', 'ASC').addOrderBy('p.code', 'ASC');

    const [products, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: products.map(toProductResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findById(companyId: string, id: string): Promise<ProductResponse> {
    const product = await this.findEntityOrThrow(companyId, id);
    return toProductResponse(product);
  }

  async create(
    companyId: string,
    dto: CreateProductDto,
  ): Promise<ProductResponse> {
    await this.assertUniqueCode(companyId, dto.code);

    const product = this.productRepository.create({
      companyId,
      code: dto.code,
      description: dto.description,
      unitPrice: dto.unitPrice.toFixed(2),
      isActive: true,
    });

    const saved = await this.productRepository.save(product);
    return toProductResponse(saved);
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    const product = await this.findEntityOrThrow(companyId, id);

    const code = dto.code ?? product.code;
    if (code !== product.code) {
      await this.assertUniqueCode(companyId, code, id);
    }

    if (dto.code !== undefined) product.code = dto.code;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.unitPrice !== undefined) {
      product.unitPrice = dto.unitPrice.toFixed(2);
    }
    if (dto.isActive !== undefined) product.isActive = dto.isActive;

    const saved = await this.productRepository.save(product);
    return toProductResponse(saved);
  }

  private async findEntityOrThrow(
    companyId: string,
    id: string,
  ): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id, companyId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private async assertUniqueCode(
    companyId: string,
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.productRepository.findOne({
      where: { companyId, code },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        'A product with this code already exists for this company',
      );
    }
  }
}
