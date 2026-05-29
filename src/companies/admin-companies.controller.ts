import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../auth/guards/admin-api-key.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CompanyCreatedResponse } from './types/company-response.types';

@Controller('admin/companies')
@UseGuards(AdminApiKeyGuard)
export class AdminCompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  create(@Body() dto: CreateCompanyDto): Promise<CompanyCreatedResponse> {
    return this.companiesService.create(dto);
  }
}
