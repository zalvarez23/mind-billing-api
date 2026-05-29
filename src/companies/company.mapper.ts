import { Company } from './entities/company.entity';
import { CompanyResponse } from './types/company-response.types';

export function toCompanyResponse(company: Company): CompanyResponse {
  return {
    id: company.id,
    ruc: company.ruc,
    businessName: company.businessName,
    tradeName: company.tradeName,
    address: company.address,
    ubigeo: company.ubigeo,
    sunatEnvironment: company.sunatEnvironment,
    solUsername: company.solUsername,
    hasSolPassword: Boolean(company.solPassword),
    isActive: company.isActive,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}
