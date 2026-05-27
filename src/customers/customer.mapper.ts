import { Customer } from './entities/customer.entity';
import { CustomerResponse } from './types/customer-response.types';

export function toCustomerResponse(customer: Customer): CustomerResponse {
  return {
    id: customer.id,
    docType: customer.docType,
    docNumber: customer.docNumber,
    legalName: customer.legalName,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    ubigeo: customer.ubigeo,
    isActive: customer.isActive,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}
