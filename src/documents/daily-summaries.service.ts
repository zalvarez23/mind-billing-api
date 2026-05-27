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
import { VoidDailySummaryDto } from './dto/void-daily-summary.dto';
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

const BOLETA_DOC_TYPE = '03';
const RC_DOC_TYPES = ['03', '07', '08'] as const;
const STATUS_POLL_ATTEMPTS = 5;
const STATUS_POLL_DELAY_MS = 2000;
const VOID_CONDITION_CODE = '3';
const ALTA_CONDITION_CODE = '1';

type SummarySubmitOutcome = 'accept-as-accepted' | 'accept-as-voided';

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
        const blockedCount = await documentRepo.count({
          where: {
            companyId: company.id,
            docType: In([...RC_DOC_TYPES]),
            status: DocumentStatus.SIGNED,
            issueDate: referenceDate,
            dailySummaryId: Not(IsNull()),
          },
        });

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

      for (const doc of documents) {
        doc.dailySummaryId = summary.id;
        await documentRepo.save(doc);
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

    const boletas = await this.documentRepository.find({
      where: {
        id: In(dto.documentIds),
        companyId: company.id,
        docType: BOLETA_DOC_TYPE,
        status: DocumentStatus.ACCEPTED,
      },
    });

    if (boletas.length !== dto.documentIds.length) {
      throw new BadRequestException(
        'All documentIds must be accepted boletas (03) of this company',
      );
    }

    const referenceDate = this.resolveVoidReferenceDate(
      dto.referenceDate,
      boletas[0]?.issueDate,
    );

    for (const boleta of boletas) {
      if (!boleta.issueDate) {
        throw new BadRequestException(
          `Boleta ${boleta.serie}-${boleta.correlativo} has no issueDate`,
        );
      }
      if (boleta.issueDate !== referenceDate) {
        throw new BadRequestException(
          `All boletas must share referenceDate ${referenceDate}. Boleta ${boleta.serie}-${boleta.correlativo} was issued on ${boleta.issueDate}.`,
        );
      }
      if (!boleta.dailySummaryId) {
        throw new BadRequestException(
          `Boleta ${boleta.serie}-${boleta.correlativo} was never accepted via RC`,
        );
      }
      if (hasRcVoidInProgress(boleta.payload)) {
        throw new BadRequestException(
          `Boleta ${boleta.serie}-${boleta.correlativo} already has a void RC in progress`,
        );
      }
    }

    const prepared = await this.dataSource.transaction(async (manager) => {
      const documentRepo = manager.getRepository(Document);
      const summaryRepo = manager.getRepository(DailySummary);

      await this.assertNoPendingRc(company.id, issueDate, summaryRepo);

      const correlativo = await this.nextRcCorrelativo(
        company.id,
        issueDate,
        summaryRepo,
      );

      const lines = boletas.map((doc, index) =>
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

      for (const boleta of boletas) {
        markBoletaVoidPending(boleta, summary.id);
        await documentRepo.save(boleta);
      }

      return {
        summary,
        documents: boletas,
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
    const summary = await this.dailySummaryRepository.findOne({
      where: { id: summaryId, companyId },
      relations: { documents: true },
    });

    if (!summary) {
      throw new NotFoundException('Daily summary not found');
    }

    return summary;
  }

  private async submitRcToSunat(
    company: Company,
    prepared: {
      summary: DailySummary;
      documents: Document[];
      xml: string;
      fileBaseName: string;
      xmlFileName: string;
    },
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

  private async assertNoPendingRc(
    companyId: string,
    issueDate: string,
    summaryRepo: Repository<DailySummary>,
  ): Promise<void> {
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
    summary.status =
      classified.status === DocumentStatus.FAILED
        ? DailySummaryStatus.FAILED
        : DailySummaryStatus.REJECTED;
    summary.errorMessage = classified.errorMessage;
    await this.dailySummaryRepository.save(summary);

    if (!summary.ticket) {
      if (outcome === 'accept-as-voided') {
        for (const doc of documents) {
          revertBoletaVoidPending(doc);
          await this.documentRepository.save(doc);
        }
      } else {
        await this.releaseDocumentsFromSummary(documents);
      }
    }

    throw new BadRequestException({
      message: classified.errorMessage,
      dailySummaryId: summary.id,
      status: summary.status,
      ticket: summary.ticket,
      hint: summary.ticket ? hintWithTicket : undefined,
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
      documents.every((doc) => doc.docType === BOLETA_DOC_TYPE) &&
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
        'referenceDate is required when boletas have no issueDate',
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
