import { Product } from './entities/product.entity';
import { ProductResponse } from './types/product-response.types';

export function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    code: product.code,
    description: product.description,
    unitPrice: Number(product.unitPrice),
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
