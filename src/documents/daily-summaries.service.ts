import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { DocumentStatus } from '../common/enums';
import { User } from '../users/entities/user.entity';
import {
  BillServiceClient,
  type GetStatusResult,
} from '../sunat/bill-service.client';
import { classifySunatSubmissionError } from '../sunat/sunat-error.util';
import { CloseDailySummaryDto } from './dto/close-daily-summary.dto';
import { PreviewCloseDailySummaryDto } from './dto/preview-close-daily-summary.dto';
import { PreviewVoidDailySummaryDto } from './dto/preview-void-daily-summary.dto';
import { VoidDailySummaryDto } from './dto/void-daily-summary.dto';
import { ListDailySummariesQueryDto } from './dto/list-daily-summaries-query.dto';
import { toDailySummaryResponse } from './daily-summary.mapper';
import {
  aggregatePreviewTotals,
  paginateArray,
  toPreviewDocumentItem,
} from './daily-summaries-preview.util';
import type { DailySummaryPreviewResponse } from './types/daily-summary-preview.types';
import { DailySummaryListResponse } from './types/daily-summary-response.types';
import {
  buildSummaryLine,
  finalizeBoletaVoid,
  isVoidRcXml,
  markBoletaVoidPending,
  revertBoletaVoidPending,
} from './daily-summaries-rc.util';
import {
  DailySummariesXmlHelper,
  type SignedRcXmlResult,
} from './daily-summaries-xml.helper';
import { Document } from './entities/document.entity';
import {
  DailySummary,
  DailySummaryStatus,
  DailySummaryType,
} from './entities/daily-summary.entity';
import { hasRcVoidInProgress } from './types/document-payload.types';
import { getBusinessIsoDate } from '../common/date-time.util';

const RC_DOC_TYPES = ['03', '07', '08'] as const;
const VOID_RC_DOC_TYPES = RC_DOC_TYPES;
const STATUS_POLL_ATTEMPTS = 5;
const STATUS_POLL_DELAY_MS = 2000;
const VOID_CONDITION_CODE = '3';
const ALTA_CONDITION_CODE = '1';

type SummarySubmitOutcome = 'accept-as-accepted' | 'accept-as-voided';

type PreparedRcSubmit = {
  summary: DailySummary;
  documents: Document[];
  xml: string;
  fileBaseName: string;
  xmlFileName: string;
  /** RC altas: link docs only after SUNAT returns a ticket. */
  linkDocumentsOnTicket?: boolean;
};

@Injectable()
export class DailySummariesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(DailySummary)
    private readonly dailySummaryRepository: Repository<DailySummary>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly rcXmlHelper: DailySummariesXmlHelper,
    private readonly billServiceClient: BillServiceClient,
  ) {}

  async previewCloseDailySummary(
    company: Company,
    dto: PreviewCloseDailySummaryDto,
  ): Promise<DailySummaryPreviewResponse> {
    const referenceDate = dto.referenceDate ?? this.todayIsoDate();
    const issueDate = dto.issueDate ?? this.todayIsoDate();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const { documents, blockedCount } = await this.findAltaRcDocuments(
      company.id,
      referenceDate,
    );

    const warnings = await this.collectPendingRcWarnings(company.id, issueDate);

    if (documents.length === 0) {
      return this.buildEmptyAltaPreview(
        referenceDate,
        issueDate,
        blockedCount,
        warnings,
        page,
        limit,
      );
    }

    const issueDateYmd = issueDate.replace(/-/g, '');
    const correlativo = await this.nextRcCorrelativo(
      company.id,
      issueDate,
      this.dailySummaryRepository,
    );
    const lines = documents.map((doc, index) =>
      buildSummaryLine(doc, index + 1, ALTA_CONDITION_CODE),
    );
    const signedXml = await this.rcXmlHelper.buildSignedRcXml(
      company,
      {
        ruc: company.ruc,
        businessName: company.businessName,
        referenceDate,
        issueDate,
        lines,
      },
      issueDateYmd,
      correlativo,
    );

    return this.buildRcPreviewResponse({
      variant: 'alta',
      referenceDate,
      issueDate,
      conditionCode: ALTA_CONDITION_CODE,
      correlativo,
      documents,
      lines,
      signedXml,
      blockedCount,
      warnings,
      page,
      limit,
      includeXml: dto.includeXml === true,
    });
  }

  async previewVoidDailySummary(
    company: Company,
    dto: PreviewVoidDailySummaryDto,
  ): Promise<DailySummaryPreviewResponse> {
    const issueDate = dto.issueDate ?? this.todayIsoDate();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const documents = await this.loadVoidDocuments(company.id, dto);
    const referenceDate = this.resolveVoidReferenceDate(
      dto.referenceDate,
      documents[0]?.issueDate,
    );

    const warnings = await this.collectPendingRcWarnings(company.id, issueDate);

    const issueDateYmd = issueDate.replace(/-/g, '');
    const correlativo = await this.nextRcCorrelativo(
      company.id,
      issueDate,
      this.dailySummaryRepository,
    );
    const lines = documents.map((doc, index) =>
      buildSummaryLine(doc, index + 1, VOID_CONDITION_CODE),
    );
    const signedXml = await this.rcXmlHelper.buildSignedRcXml(
      company,
      {
        ruc: company.ruc,
        businessName: company.businessName,
        referenceDate,
        issueDate,
        lines,
      },
      issueDateYmd,
      correlativo,
    );

    return this.buildRcPreviewResponse({
      variant: 'void',
      referenceDate,
      issueDate,
      conditionCode: VOID_CONDITION_CODE,
      correlativo,
      documents,
      lines,
      signedXml,
      warnings,
      page,
      limit,
      includeXml: dto.includeXml === true,
    });
  }

  async closeDailySummary(
    company: Company,
    user: User,
    dto: CloseDailySummaryDto,
  ): Promise<Record<string, unknown>> {
    const referenceDate = dto.referenceDate ?? this.todayIsoDate();
    const issueDate = dto.issueDate ?? this.todayIsoDate();
    const issueDateYmd = issueDate.replace(/-/g, '');

    const prepared = await this.dataSource.transaction(async (manager) => {
      const documentRepo = manager.getRepository(Document);
      const summaryRepo = manager.getRepository(DailySummary);

      await this.assertNoPendingRc(company.id, issueDate, summaryRepo);

      const documents = await documentRepo.find({
        where: {
          companyId: company.id,
          docType: In([...RC_DOC_TYPES]),
          status: DocumentStatus.SIGNED,
          issueDate: referenceDate,
          dailySummaryId: IsNull(),
        },
        order: { docType: 'ASC', serie: 'ASC', correlativo: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      if (documents.length === 0) {
        const blockedCount = await this.countBlockedAltaRcDocuments(
          company.id,
          referenceDate,
          documentRepo,
        );

        if (blockedCount > 0) {
          throw new BadRequestException(
            `All signed boletas/notes for ${referenceDate} are already linked to an RC. Refresh the existing daily summary status or wait for SUNAT before creating another RC.`,
          );
        }

        throw new BadRequestException(
          `No signed boletas/notes pending RC for reference date ${referenceDate}`,
        );
      }

      const correlativo = await this.nextRcCorrelativo(
        company.id,
        issueDate,
        summaryRepo,
      );

      const lines = documents.map((doc, index) =>
        buildSummaryLine(doc, index + 1, ALTA_CONDITION_CODE),
      );

      const signedXml = await this.rcXmlHelper.buildSignedRcXml(
        company,
        {
          ruc: company.ruc,
          businessName: company.businessName,
          referenceDate,
          issueDate,
          lines,
        },
        issueDateYmd,
        correlativo,
      );

      const summary = await summaryRepo.save(
        summaryRepo.create({
          companyId: company.id,
          createdById: user.id,
          summaryType: DailySummaryType.RC,
          summaryCode: signedXml.summaryCode,
          referenceDate,
          issueDate,
          correlativo,
          status: DailySummaryStatus.DRAFT,
          xmlContent: signedXml.xml,
        }),
      );

      return {
        summary,
        documents,
        xml: signedXml.xml,
        fileBaseName: signedXml.fileBaseName,
        xmlFileName: signedXml.xmlFileName,
        linkDocumentsOnTicket: true,
      };
    });

    return this.submitRcToSunat(
      company,
      prepared,
      'accept-as-accepted',
      'RC was submitted; poll status with POST /v1/daily-summaries/:id/status',
    );
  }

  async voidDailySummary(
    company: Company,
    user: User,
    dto: VoidDailySummaryDto,
  ): Promise<Record<string, unknown>> {
    const issueDate = dto.issueDate ?? this.todayIsoDate();
    const issueDateYmd = issueDate.replace(/-/g, '');

    const documents = await this.loadVoidDocuments(company.id, dto);

    const referenceDate = this.resolveVoidReferenceDate(
      dto.referenceDate,
      documents[0]?.issueDate,
    );

    const prepared = await this.dataSource.transaction(async (manager) => {
      const documentRepo = manager.getRepository(Document);
      const summaryRepo = manager.getRepository(DailySummary);

      await this.assertNoPendingRc(company.id, issueDate, summaryRepo);

      const correlativo = await this.nextRcCorrelativo(
        company.id,
        issueDate,
        summaryRepo,
      );

      const lines = documents.map((doc, index) =>
        buildSummaryLine(doc, index + 1, VOID_CONDITION_CODE),
      );

      const signedXml: SignedRcXmlResult =
        await this.rcXmlHelper.buildSignedRcXml(
          company,
          {
            ruc: company.ruc,
            businessName: company.businessName,
            referenceDate,
            issueDate,
            lines,
          },
          issueDateYmd,
          correlativo,
        );

      const summary = await summaryRepo.save(
        summaryRepo.create({
          companyId: company.id,
          createdById: user.id,
          summaryType: DailySummaryType.RC,
          summaryCode: signedXml.summaryCode,
          referenceDate,
          issueDate,
          correlativo,
          status: DailySummaryStatus.DRAFT,
          xmlContent: signedXml.xml,
        }),
      );

      for (const document of documents) {
        markBoletaVoidPending(document, summary.id);
        await documentRepo.save(document);
      }

      return {
        summary,
        documents,
        xml: signedXml.xml,
        fileBaseName: signedXml.fileBaseName,
        xmlFileName: signedXml.xmlFileName,
      };
    });

    return this.submitRcToSunat(
      company,
      prepared,
      'accept-as-voided',
      'Void RC was submitted; poll status with POST /v1/daily-summaries/:id/status',
    );
  }

  async refreshStatus(
    company: Company,
    summaryId: string,
  ): Promise<Record<string, unknown>> {
    const summary = await this.dailySummaryRepository.findOne({
      where: { id: summaryId, companyId: company.id },
    });

    if (!summary) {
      throw new NotFoundException('Daily summary not found');
    }

    if (!summary.ticket) {
      throw new BadRequestException('Daily summary has no SUNAT ticket');
    }

    if (
      summary.status === DailySummaryStatus.ACCEPTED ||
      summary.status === DailySummaryStatus.REJECTED
    ) {
      return this.toResponse(summary);
    }

    const documents = await this.documentRepository.find({
      where: { dailySummaryId: summary.id },
    });

    try {
      const statusResult = await this.pollSummaryStatus(
        company,
        summary.ticket,
      );
      const outcome = this.resolveSummaryOutcome(summary, documents);

      return this.applyStatusResult(summary, documents, statusResult, outcome);
    } catch (error) {
      const classified = classifySunatSubmissionError(error);
      summary.status = DailySummaryStatus.FAILED;
      summary.errorMessage = classified.errorMessage;
      await this.dailySummaryRepository.save(summary);

      throw new BadRequestException({
        message: classified.errorMessage,
        dailySummaryId: summary.id,
        status: summary.status,
        ticket: summary.ticket,
        hint: 'SUNAT beta may be slow. Retry this endpoint in a few minutes.',
      });
    }
  }

  async findById(companyId: string, summaryId: string): Promise<DailySummary> {
    const summary = await this.dailySummaryRepository
      .createQueryBuilder('summary')
      .leftJoinAndSelect('summary.documents', 'doc')
      .where('summary.id = :summaryId', { summaryId })
      .andWhere('summary.companyId = :companyId', { companyId })
      .orderBy('doc.docType', 'ASC')
      .addOrderBy('doc.serie', 'ASC')
      .addOrderBy('doc.correlativo', 'ASC')
      .getOne();

    if (!summary) {
      throw new NotFoundException('Daily summary not found');
    }

    return summary;
  }

  async findAll(
    companyId: string,
    query: ListDailySummariesQueryDto,
  ): Promise<DailySummaryListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.dailySummaryRepository
      .createQueryBuilder('summary')
      .loadRelationCountAndMap('summary.documentCount', 'summary.documents')
      .where('summary.companyId = :companyId', { companyId });

    if (query.referenceDate) {
      qb.andWhere('summary.referenceDate = :referenceDate', {
        referenceDate: query.referenceDate,
      });
    }

    if (query.issueDate) {
      qb.andWhere('summary.issueDate = :issueDate', {
        issueDate: query.issueDate,
      });
    } else {
      if (query.from) {
        qb.andWhere('summary.issueDate >= :from', { from: query.from });
      }
      if (query.to) {
        qb.andWhere('summary.issueDate <= :to', { to: query.to });
      }
    }

    if (query.summaryType) {
      qb.andWhere('summary.summaryType = :summaryType', {
        summaryType: query.summaryType,
      });
    }

    if (query.status) {
      qb.andWhere('summary.status = :status', { status: query.status });
    }

    qb.orderBy('summary.issueDate', 'DESC').addOrderBy(
      'summary.correlativo',
      'DESC',
    );

    const [summaries, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: summaries.map((summary) =>
        toDailySummaryResponse(
          summary,
          (summary as DailySummary & { documentCount?: number }).documentCount,
        ),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private async submitRcToSunat(
    company: Company,
    prepared: PreparedRcSubmit,
    outcome: SummarySubmitOutcome,
    hintWithTicket: string,
  ): Promise<Record<string, unknown>> {
    try {
      prepared.summary.status = DailySummaryStatus.SUBMITTED;
      await this.dailySummaryRepository.save(prepared.summary);

      const sendResult = await this.billServiceClient.sendSummary(
        company,
        prepared.xmlFileName,
        prepared.xml,
      );

      prepared.summary.ticket = sendResult.ticket;
      prepared.summary.status = DailySummaryStatus.PROCESSING;
      await this.dailySummaryRepository.save(prepared.summary);

      if (prepared.linkDocumentsOnTicket) {
        await this.linkAltaDocumentsToSummary(
          prepared.summary,
          prepared.documents,
        );
      }

      const statusResult = await this.pollSummaryStatus(
        company,
        sendResult.ticket,
      );
      return this.applyStatusResult(
        prepared.summary,
        prepared.documents,
        statusResult,
        outcome,
      );
    } catch (error) {
      return this.handleSubmitError(
        error,
        prepared.summary,
        prepared.documents,
        hintWithTicket,
        outcome,
      );
    }
  }

  private async pollSummaryStatus(
    company: Company,
    ticket: string,
  ): Promise<GetStatusResult> {
    let lastResult = await this.billServiceClient.getStatus(company, ticket);

    for (
      let attempt = 1;
      attempt < STATUS_POLL_ATTEMPTS && lastResult.processing;
      attempt += 1
    ) {
      await this.sleep(STATUS_POLL_DELAY_MS);
      lastResult = await this.billServiceClient.getStatus(company, ticket);
    }

    return lastResult;
  }

  private async applyStatusResult(
    summary: DailySummary,
    documents: Document[],
    statusResult: GetStatusResult,
    outcome: SummarySubmitOutcome,
  ): Promise<Record<string, unknown>> {
    summary.statusCode = statusResult.statusCode;

    if (statusResult.processing) {
      summary.status = DailySummaryStatus.PROCESSING;
      summary.errorMessage = statusResult.description;
      await this.dailySummaryRepository.save(summary);

      return {
        ...this.toResponse(summary),
        sunat: {
          statusCode: statusResult.statusCode,
          description: statusResult.description,
          processing: true,
        },
      };
    }

    if (statusResult.accepted) {
      summary.status = DailySummaryStatus.ACCEPTED;
      summary.cdrXml = statusResult.cdrXml;
      summary.errorMessage = null;
      await this.dailySummaryRepository.save(summary);

      for (const doc of documents) {
        if (outcome === 'accept-as-voided') {
          finalizeBoletaVoid(doc, summary.id);
        } else {
          doc.status = DocumentStatus.ACCEPTED;
        }
        await this.documentRepository.save(doc);
      }

      return {
        ...this.toResponse(summary),
        sunat: {
          statusCode: statusResult.statusCode,
          description: statusResult.description,
          accepted: true,
          documentCount: documents.length,
          ...(outcome === 'accept-as-voided'
            ? { voidedCount: documents.length }
            : {}),
        },
      };
    }

    summary.status = DailySummaryStatus.REJECTED;
    summary.cdrXml = statusResult.cdrXml;
    summary.errorMessage =
      statusResult.description ?? 'SUNAT rejected daily summary';
    await this.dailySummaryRepository.save(summary);

    for (const doc of documents) {
      if (outcome === 'accept-as-voided') {
        revertBoletaVoidPending(doc);
      } else {
        doc.status = DocumentStatus.SIGNED;
        doc.dailySummaryId = null;
      }
      await this.documentRepository.save(doc);
    }

    throw new BadRequestException({
      message: summary.errorMessage,
      dailySummaryId: summary.id,
      status: summary.status,
      sunat: {
        statusCode: statusResult.statusCode,
        description: statusResult.description,
        accepted: false,
      },
    });
  }

  private async releaseDocumentsFromSummary(
    documents: Document[],
  ): Promise<void> {
    for (const doc of documents) {
      doc.dailySummaryId = null;
      await this.documentRepository.save(doc);
    }
  }

  private async linkAltaDocumentsToSummary(
    summary: DailySummary,
    documents: Document[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const documentRepo = manager.getRepository(Document);

      for (const doc of documents) {
        const locked = await documentRepo.findOne({
          where: { id: doc.id, companyId: summary.companyId },
          lock: { mode: 'pessimistic_write' },
        });

        if (
          !locked ||
          locked.status !== DocumentStatus.SIGNED ||
          locked.dailySummaryId !== null
        ) {
          throw new BadRequestException(
            `Document ${doc.serie}-${doc.correlativo} is no longer available for RC`,
          );
        }

        locked.dailySummaryId = summary.id;
        await documentRepo.save(locked);
        doc.dailySummaryId = summary.id;
      }
    });
  }

  private async findAltaRcDocuments(
    companyId: string,
    referenceDate: string,
  ): Promise<{ documents: Document[]; blockedCount: number }> {
    const documents = await this.documentRepository.find({
      where: {
        companyId,
        docType: In([...RC_DOC_TYPES]),
        status: DocumentStatus.SIGNED,
        issueDate: referenceDate,
        dailySummaryId: IsNull(),
      },
      order: { docType: 'ASC', serie: 'ASC', correlativo: 'ASC' },
    });

    const blockedCount = await this.countBlockedAltaRcDocuments(
      companyId,
      referenceDate,
      this.documentRepository,
    );

    return { documents, blockedCount };
  }

  private async countBlockedAltaRcDocuments(
    companyId: string,
    referenceDate: string,
    documentRepo: Repository<Document>,
  ): Promise<number> {
    return documentRepo.count({
      where: {
        companyId,
        docType: In([...RC_DOC_TYPES]),
        status: DocumentStatus.SIGNED,
        issueDate: referenceDate,
        dailySummaryId: Not(IsNull()),
      },
    });
  }

  private async loadVoidDocuments(
    companyId: string,
    dto: VoidDailySummaryDto,
  ): Promise<Document[]> {
    const documents = await this.documentRepository.find({
      where: {
        id: In(dto.documentIds),
        companyId,
        docType: In([...VOID_RC_DOC_TYPES]),
        status: DocumentStatus.ACCEPTED,
      },
      order: { docType: 'ASC', serie: 'ASC', correlativo: 'ASC' },
    });

    if (documents.length !== dto.documentIds.length) {
      throw new BadRequestException(
        'All documentIds must be accepted boletas or notes (03, 07, 08) of this company',
      );
    }

    const referenceDate = this.resolveVoidReferenceDate(
      dto.referenceDate,
      documents[0]?.issueDate,
    );

    for (const document of documents) {
      const label = this.formatVoidDocumentLabel(document);

      if (!document.issueDate) {
        throw new BadRequestException(`${label} has no issueDate`);
      }
      if (document.issueDate !== referenceDate) {
        throw new BadRequestException(
          `All documents must share referenceDate ${referenceDate}. ${label} was issued on ${document.issueDate}.`,
        );
      }
      if (!document.dailySummaryId) {
        throw new BadRequestException(
          `${label} was never accepted via RC (only documents from daily summary can be voided here)`,
        );
      }
      if (hasRcVoidInProgress(document.payload)) {
        throw new BadRequestException(
          `${label} already has a void RC in progress`,
        );
      }
    }

    return documents;
  }

  private formatVoidDocumentLabel(document: Document): string {
    return `Document ${document.docType} ${document.serie}-${document.correlativo}`;
  }

  private async collectPendingRcWarnings(
    companyId: string,
    issueDate: string,
  ): Promise<DailySummaryPreviewResponse['warnings']> {
    const pendingWithTicket = await this.dailySummaryRepository.findOne({
      where: {
        companyId,
        issueDate,
        summaryType: DailySummaryType.RC,
        status: In([
          DailySummaryStatus.PROCESSING,
          DailySummaryStatus.FAILED,
          DailySummaryStatus.SUBMITTED,
        ]),
        ticket: Not(IsNull()),
      },
      order: { correlativo: 'DESC' },
    });

    if (!pendingWithTicket) {
      return [];
    }

    return [
      {
        code: 'PENDING_RC',
        message: `RC ${pendingWithTicket.summaryCode} already sent to SUNAT (ticket ${pendingWithTicket.ticket}). Resolve it before creating another RC.`,
        dailySummaryId: pendingWithTicket.id,
        ticket: pendingWithTicket.ticket ?? undefined,
        status: pendingWithTicket.status,
      },
    ];
  }

  private buildEmptyAltaPreview(
    referenceDate: string,
    issueDate: string,
    blockedCount: number,
    warnings: DailySummaryPreviewResponse['warnings'],
    page: number,
    limit: number,
  ): DailySummaryPreviewResponse {
    const emptyPage = paginateArray([], page, limit);

    return {
      variant: 'alta',
      summaryType: 'RC',
      referenceDate,
      issueDate,
      summaryCode: null,
      correlativo: null,
      conditionCode: ALTA_CONDITION_CODE,
      documentCount: 0,
      ...(blockedCount > 0 ? { blockedDocumentCount: blockedCount } : {}),
      totals: null,
      files: null,
      lines: null,
      xml: null,
      warnings,
      documents: {
        data: [],
        meta: emptyPage.meta,
      },
    };
  }

  private buildRcPreviewResponse(input: {
    variant: 'alta' | 'void';
    referenceDate: string;
    issueDate: string;
    conditionCode: string;
    correlativo: number;
    documents: Document[];
    lines: ReturnType<typeof buildSummaryLine>[];
    signedXml: SignedRcXmlResult;
    blockedCount?: number;
    warnings: DailySummaryPreviewResponse['warnings'];
    page: number;
    limit: number;
    includeXml: boolean;
  }): DailySummaryPreviewResponse {
    const previewItems = input.documents.map((doc, index) =>
      toPreviewDocumentItem(doc, input.lines[index]),
    );
    const paginated = paginateArray(previewItems, input.page, input.limit);
    const amountTotals = aggregatePreviewTotals(input.lines);
    const xml = input.signedXml.xml;

    return {
      variant: input.variant,
      summaryType: 'RC',
      referenceDate: input.referenceDate,
      issueDate: input.issueDate,
      summaryCode: input.signedXml.summaryCode,
      correlativo: input.correlativo,
      conditionCode: input.conditionCode,
      documentCount: input.documents.length,
      ...(input.blockedCount !== undefined && input.blockedCount > 0
        ? { blockedDocumentCount: input.blockedCount }
        : {}),
      totals: {
        documentCount: input.documents.length,
        ...amountTotals,
      },
      files: {
        xmlFileName: input.signedXml.xmlFileName,
        zipFileName: input.signedXml.xmlFileName.replace(/\.xml$/i, '.zip'),
        xmlSizeBytes: Buffer.byteLength(xml, 'utf8'),
      },
      lines: input.lines,
      xml: input.includeXml ? xml : null,
      warnings: input.warnings,
      documents: paginated,
    };
  }

  private async assertNoPendingRc(
    companyId: string,
    issueDate: string,
    summaryRepo: Repository<DailySummary>,
  ): Promise<void> {
    const inFlightWithoutTicket = await summaryRepo.findOne({
      where: {
        companyId,
        issueDate,
        summaryType: DailySummaryType.RC,
        status: In([DailySummaryStatus.DRAFT, DailySummaryStatus.SUBMITTED]),
        ticket: IsNull(),
      },
      order: { correlativo: 'DESC' },
    });

    if (inFlightWithoutTicket) {
      throw new BadRequestException({
        message: `RC ${inFlightWithoutTicket.summaryCode} is still being submitted. Wait for it to finish or retry shortly.`,
        dailySummaryId: inFlightWithoutTicket.id,
        status: inFlightWithoutTicket.status,
      });
    }

    const pendingWithTicket = await summaryRepo.findOne({
      where: {
        companyId,
        issueDate,
        summaryType: DailySummaryType.RC,
        status: In([
          DailySummaryStatus.PROCESSING,
          DailySummaryStatus.FAILED,
          DailySummaryStatus.SUBMITTED,
        ]),
        ticket: Not(IsNull()),
      },
      order: { correlativo: 'DESC' },
    });

    if (pendingWithTicket) {
      throw new BadRequestException({
        message: `RC ${pendingWithTicket.summaryCode} already sent to SUNAT (ticket ${pendingWithTicket.ticket}). Use POST /v1/daily-summaries/${pendingWithTicket.id}/status instead of creating a new RC.`,
        dailySummaryId: pendingWithTicket.id,
        ticket: pendingWithTicket.ticket,
        status: pendingWithTicket.status,
      });
    }
  }

  private async nextRcCorrelativo(
    companyId: string,
    issueDate: string,
    summaryRepo: Repository<DailySummary>,
  ): Promise<number> {
    const lastSummary = await summaryRepo.findOne({
      where: {
        companyId,
        issueDate,
        summaryType: DailySummaryType.RC,
      },
      order: { correlativo: 'DESC' },
    });

    return (lastSummary?.correlativo ?? 0) + 1;
  }

  private async handleSubmitError(
    error: unknown,
    summary: DailySummary,
    documents: Document[],
    hintWithTicket: string,
    outcome: SummarySubmitOutcome = 'accept-as-accepted',
  ): Promise<never> {
    const classified = classifySunatSubmissionError(error);
    summary.errorMessage = classified.errorMessage;

    if (!summary.ticket && outcome === 'accept-as-accepted') {
      summary.status = DailySummaryStatus.CANCELLED;
      await this.dailySummaryRepository.save(summary);
    } else {
      summary.status =
        classified.status === DocumentStatus.FAILED
          ? DailySummaryStatus.FAILED
          : DailySummaryStatus.REJECTED;
      await this.dailySummaryRepository.save(summary);
    }

    if (!summary.ticket) {
      if (outcome === 'accept-as-voided') {
        for (const doc of documents) {
          revertBoletaVoidPending(doc);
          await this.documentRepository.save(doc);
        }
      } else if (outcome !== 'accept-as-accepted') {
        await this.releaseDocumentsFromSummary(documents);
      }
    }

    throw new BadRequestException({
      message: classified.errorMessage,
      dailySummaryId: summary.id,
      status: summary.status,
      ticket: summary.ticket,
      hint: summary.ticket
        ? hintWithTicket
        : outcome === 'accept-as-accepted'
          ? 'SUNAT did not return a ticket. Boletas were not linked; you may POST /v1/daily-summaries again.'
          : undefined,
    });
  }

  private resolveSummaryOutcome(
    summary: DailySummary,
    documents: Document[],
  ): SummarySubmitOutcome {
    if (isVoidRcXml(summary.xmlContent)) {
      return 'accept-as-voided';
    }

    if (
      documents.length > 0 &&
      documents.every((doc) =>
        (VOID_RC_DOC_TYPES as readonly string[]).includes(doc.docType),
      ) &&
      documents.every((doc) => doc.status === DocumentStatus.ACCEPTED)
    ) {
      return 'accept-as-voided';
    }

    return 'accept-as-accepted';
  }

  private toResponse(summary: DailySummary): Record<string, unknown> {
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
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    };
  }

  private resolveVoidReferenceDate(
    dtoReferenceDate: string | undefined,
    firstBoletaIssueDate: string | null | undefined,
  ): string {
    const referenceDate = dtoReferenceDate ?? firstBoletaIssueDate ?? '';
    if (!referenceDate) {
      throw new BadRequestException(
        'referenceDate is required when documents have no issueDate',
      );
    }
    return referenceDate;
  }

  private todayIsoDate(): string {
    return getBusinessIsoDate();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
