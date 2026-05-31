import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CompanyMatchGuard, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCompany } from '../common/decorators/current-company.decorator';
import { CompaniesService } from './companies.service';
import { Company } from './entities/company.entity';
import { CompanyResponse } from './types/company-response.types';

@Controller('companies')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get(':id')
  findOne(
    @CurrentCompany() company: Company,
    @Param('id') id: string,
  ): Promise<CompanyResponse> {
    return this.companiesService.findById(company.id, id);
  }
}
