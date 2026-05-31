import { Controller, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { CompanyMatchGuard, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCompany } from '../common/decorators/current-company.decorator';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
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

  @Patch(':id')
  update(
    @CurrentCompany() company: Company,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyResponse> {
    return this.companiesService.update(company.id, id, dto);
  }
}
