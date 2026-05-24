import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CompanyMatchGuard, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCompany } from '../common/decorators/current-company.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { DocumentsService } from './documents.service';

@Controller('invoices')
@UseGuards(ApiKeyGuard, JwtAuthGuard, CompanyMatchGuard)
export class InvoicesController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  create(
    @CurrentCompany() company: Company,
    @CurrentUser() user: User,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.documentsService.createInvoice(company, user, dto);
  }
}

@Controller('documents')
@UseGuards(ApiKeyGuard, JwtAuthGuard, CompanyMatchGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(':id')
  async findOne(@CurrentCompany() company: Company, @Param('id') id: string) {
    const document = await this.documentsService.findById(company.id, id);
    const latestSubmission = document.submissions?.[0];

    return {
      id: document.id,
      docType: document.docType,
      serie: document.serie,
      correlativo: document.correlativo,
      status: document.status,
      total: document.total,
      payload: document.payload,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      sunat: latestSubmission
        ? {
            method: latestSubmission.method,
            statusCode: latestSubmission.statusCode,
            errorMessage: latestSubmission.errorMessage,
            createdAt: latestSubmission.createdAt,
          }
        : null,
    };
  }

  @Get(':id/xml')
  getXml(@CurrentCompany() company: Company, @Param('id') id: string) {
    return this.documentsService.getXml(company.id, id);
  }

  @Get(':id/cdr')
  getCdr(@CurrentCompany() company: Company, @Param('id') id: string) {
    return this.documentsService.getCdr(company.id, id);
  }
}
