import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CompanyMatchGuard, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCompany } from '../common/decorators/current-company.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { CreateBoletaDto } from './dto/create-boleta.dto';
import { CloseDailySummaryDto } from './dto/close-daily-summary.dto';
import { VoidDailySummaryDto } from './dto/void-daily-summary.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateVoidedDocumentsDto } from './dto/create-voided-documents.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { DailySummariesService } from './daily-summaries.service';
import { DocumentsService } from './documents.service';
import { toDocumentDetailResponse } from './document-detail.mapper';
import {
  BoletaCreatedResponse,
  DocumentDetailResponse,
  DocumentListResponse,
  NoteCreatedResponse,
} from './types/document-response.types';
import { VoidedDocumentsService } from './voided-documents.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
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

@Controller('boletas')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
export class BoletasController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  async create(
    @CurrentCompany() company: Company,
    @CurrentUser() user: User,
    @Body() dto: CreateBoletaDto,
  ): Promise<BoletaCreatedResponse> {
    return await this.documentsService.createBoleta(company, user, dto);
  }
}

@Controller('credit-notes')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
export class CreditNotesController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  async create(
    @CurrentCompany() company: Company,
    @CurrentUser() user: User,
    @Body() dto: CreateNoteDto,
  ): Promise<NoteCreatedResponse | Record<string, unknown>> {
    return await this.documentsService.createCreditNote(company, user, dto);
  }
}

@Controller('debit-notes')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
export class DebitNotesController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  async create(
    @CurrentCompany() company: Company,
    @CurrentUser() user: User,
    @Body() dto: CreateNoteDto,
  ): Promise<NoteCreatedResponse | Record<string, unknown>> {
    return await this.documentsService.createDebitNote(company, user, dto);
  }
}

@Controller('voided-documents')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
export class VoidedDocumentsController {
  constructor(
    private readonly voidedDocumentsService: VoidedDocumentsService,
  ) {}

  @Post()
  submit(
    @CurrentCompany() company: Company,
    @CurrentUser() user: User,
    @Body() dto: CreateVoidedDocumentsDto,
  ) {
    return this.voidedDocumentsService.submitVoidedDocuments(
      company,
      user,
      dto,
    );
  }
}

@Controller('daily-summaries')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
export class DailySummariesController {
  constructor(private readonly dailySummariesService: DailySummariesService) {}

  @Post()
  close(
    @CurrentCompany() company: Company,
    @CurrentUser() user: User,
    @Body() dto: CloseDailySummaryDto,
  ) {
    return this.dailySummariesService.closeDailySummary(company, user, dto);
  }

  @Post('void')
  voidBoletas(
    @CurrentCompany() company: Company,
    @CurrentUser() user: User,
    @Body() dto: VoidDailySummaryDto,
  ) {
    return this.dailySummariesService.voidDailySummary(company, user, dto);
  }

  @Get(':id')
  async findOne(@CurrentCompany() company: Company, @Param('id') id: string) {
    const summary = await this.dailySummariesService.findById(company.id, id);
    return {
      id: summary.id,
      summaryType: summary.summaryType,
      summaryCode: summary.summaryCode,
      referenceDate: summary.referenceDate,
      issueDate: summary.issueDate,
      correlativo: summary.correlativo,
      status: summary.status,
      ticket: summary.ticket,
      statusCode: summary.statusCode,
      errorMessage: summary.errorMessage,
      documentCount: summary.documents?.length ?? 0,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    };
  }

  @Post(':id/status')
  refreshStatus(@CurrentCompany() company: Company, @Param('id') id: string) {
    return this.dailySummariesService.refreshStatus(company, id);
  }
}

@Controller('documents')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(
    @CurrentCompany() company: Company,
    @Query() query: ListDocumentsQueryDto,
  ): Promise<DocumentListResponse> {
    return this.documentsService.findAll(company.id, query);
  }

  @Get(':id')
  async findOne(
    @CurrentCompany() company: Company,
    @Param('id') id: string,
  ): Promise<DocumentDetailResponse> {
    const doc = await this.documentsService.findById(company.id, id);
    return toDocumentDetailResponse(doc);
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
