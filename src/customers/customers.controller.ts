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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import {
  CustomerListResponse,
  CustomerResponse,
} from './types/customer-response.types';

@Controller('customers')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(
    @CurrentCompany() company: Company,
    @Query() query: ListCustomersQueryDto,
  ): Promise<CustomerListResponse> {
    return this.customersService.findAll(company.id, query);
  }

  @Get(':id')
  findOne(
    @CurrentCompany() company: Company,
    @Param('id') id: string,
  ): Promise<CustomerResponse> {
    return this.customersService.findById(company.id, id);
  }

  @Post()
  create(
    @CurrentCompany() company: Company,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerResponse> {
    return this.customersService.create(company.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentCompany() company: Company,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerResponse> {
    return this.customersService.update(company.id, id, dto);
  }
}
