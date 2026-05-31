import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { DocumentStatus } from '../common/enums';
import { User } from '../users/entities/user.entity';
import { BillServiceClient } from '../sunat/bill-service.client';
import { XmlSignatureService } from '../crypto/xml-signature.service';
import { VoidedXmlBuilder } from '../ubl/builders/voided-xml.builder';
import { VoidedLineInput } from '../ubl/interfaces/voided-build-input.interface';
import { classifySunatSubmissionError } from '../sunat/sunat-error.util';
import { CreateVoidedDocumentsDto } from './dto/create-voided-documents.dto';
import { getBusinessIsoDate } from '../common/date-time.util';
import { Document } from './entities/document.entity';
import { readDocumentPayload } from './types/document-payload.types';
import {
  DailySummary,
  DailySummaryStatus,
  DailySummaryType,
} from './entities/daily-summary.entity';

const INVOICE_DOC_TYPE = '01';
const RA_DOC_TYPES = ['01', '07', '08'] as const;
const STATUS_POLL_ATTEMPTS = 5;
const STATUS_POLL_DELAY_MS = 2000;
const DEFAULT_MOTIVO_BAJA = 'ERROR EN DATOS';

@Injectable()
export class VoidedDocumentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(DailySummary)
    private readonly dailySummaryRepository: Repository<DailySummary>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly voidedXmlBuilder: VoidedXmlBuilder,
    private readonly billServiceClient: BillServiceClient,
    private readonly xmlSignatureService: XmlSignatureService,
  ) {}

  async submitVoidedDocuments(
    company: Company,
    user: User,
    dto: CreateVoidedDocumentsDto,
  ): Promise<Record<string, unknown>> {
    const referenceDate = dto.referenceDate ?? this.todayIsoDate();
    const issueDate = dto.issueDate ?? this.todayIsoDate();
    const issueDateYmd = issueDate.replace(/-/g, '');
    const motivoBaja = dto.motivoBaja ?? DEFAULT_MOTIVO_BAJA;

    const documents = await this.loadRaDocuments(company.id, dto, referenceDate);

    const prepared = await this.dataSource.transaction(async (manager) => {
      const summaryRepo = manager.getRepository(DailySummary);
      const documentRepo = manager.getRepository(Document);

      const lastSummary = await summaryRepo.findOne({
        where: {
          companyId: company.id,
          issueDate,
          summaryType: DailySummaryType.RA,
        },
        order: { correlativo: 'DESC' },
      });
      const correlativo = (lastSummary?.correlativo ?? 0) + 1;
      const voidedCode = this.voidedXmlBuilder.buildVoidedCode(
        issueDateYmd,
        correlativo,
      );

      const lines: VoidedLineInput[] = documents.map((document, index) => ({
        lineId: index + 1,
        docType: document.docType,
        serie: document.serie,
        correlativo: document.correlativo,
        motivoBaja,
      }));

      const unsignedXml = this.voidedXmlBuilder.build({
        ruc: company.ruc,
        businessName: company.businessName,
        voidedCode,
        referenceDate,
        issueDate,
        lines,
      });

      const xml = await this.xmlSignatureService.signVoidedDocumentsXml(
        company,
        unsignedXml,
      );

      const fileBaseName = this.voidedXmlBuilder.getFileBaseName(
        company.ruc,
        issueDateYmd,
        correlativo,
      );

      const summary = await summaryRepo.save(
        summaryRepo.create({
          companyId: company.id,
          createdById: user.id,
          summaryType: DailySummaryType.RA,
          summaryCode: voidedCode,
          referenceDate,
          issueDate,
          correlativo,
          status: DailySummaryStatus.DRAFT,
          xmlContent: xml,
        }),
      );

      for (const document of documents) {
        document.dailySummaryId = summary.id;
        await documentRepo.save(document);
      }

      return {
        summary,
        documents,
        xml,
        fileBaseName,
        xmlFileName: `${fileBaseName}.xml`,
      };
    });

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
      );
    } catch (error) {
      return await this.handleSubmitError(error, prepared.summary.id);
    }
  }

  private async loadRaDocuments(
    companyId: string,
    dto: CreateVoidedDocumentsDto,
    referenceDate: string,
  ): Promise<Document[]> {
    const documents = await this.documentRepository.find({
      where: {
        id: In(dto.documentIds),
        companyId,
        docType: In([...RA_DOC_TYPES]),
        status: DocumentStatus.ACCEPTED,
      },
      order: { docType: 'ASC', serie: 'ASC', correlativo: 'ASC' },
    });

    if (documents.length !== dto.documentIds.length) {
      throw new BadRequestException(
        'All documentIds must be accepted invoices or invoice notes (01, 07, 08) of this company',
      );
    }

    for (const document of documents) {
      const label = this.formatRaDocumentLabel(document);

      if (document.dailySummaryId) {
        throw new BadRequestException(
          `${label} is already linked to a daily summary (RA in progress or RC note)`,
        );
      }

      if (!document.issueDate) {
        throw new BadRequestException(`${label} has no issueDate`);
      }

      if (document.issueDate !== referenceDate) {
        throw new BadRequestException(
          `${label} issue date does not match referenceDate ${referenceDate}`,
        );
      }

      if (document.docType === '07' || document.docType === '08') {
        const affected = readDocumentPayload(document.payload).documentoAfectado;
        if (!affected || affected.docType !== INVOICE_DOC_TYPE) {
          throw new BadRequestException(
            `${label} must reference an invoice (01); boleta notes use POST /daily-summaries/void`,
          );
        }
      }
    }

    return documents;
  }

  private formatRaDocumentLabel(document: Document): string {
    return `Document ${document.docType} ${document.serie}-${document.correlativo}`;
  }

  private async handleSubmitError(
    error: unknown,
    summaryId: string,
  ): Promise<never> {
    const classified = classifySunatSubmissionError(error);

    const summary = await this.dataSource.transaction(async (manager) => {
      const summaryRepo = manager.getRepository(DailySummary);
      const locked = await summaryRepo.findOne({
        where: { id: summaryId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new BadRequestException('Daily summary not found');
      }

      locked.status =
        classified.status === DocumentStatus.FAILED
          ? DailySummaryStatus.FAILED
          : DailySummaryStatus.REJECTED;
      locked.errorMessage = classified.errorMessage;
      await summaryRepo.save(locked);
      return locked;
    });

    if (!summary.ticket) {
      await this.releaseInvoicesFromSummary(summaryId);
    }

    throw new BadRequestException({
      message: classified.errorMessage,
      dailySummaryId: summary.id,
      status: summary.status,
      ticket: summary.ticket ?? null,
    });
  }

  private async releaseInvoicesFromSummary(summaryId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const documentRepo = manager.getRepository(Document);
      const invoices = await documentRepo.find({
        where: { dailySummaryId: summaryId },
        lock: { mode: 'pessimistic_write' },
      });

      for (const invoice of invoices) {
        invoice.dailySummaryId = null;
        await documentRepo.save(invoice);
      }
    });
  }

  private async pollSummaryStatus(company: Company, ticket: string) {
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
    statusResult: Awaited<ReturnType<BillServiceClient['getStatus']>>,
  ): Promise<Record<string, unknown>> {
    summary.statusCode = statusResult.statusCode;

    if (statusResult.processing) {
      summary.status = DailySummaryStatus.PROCESSING;
      summary.errorMessage = statusResult.description;
      await this.dailySummaryRepository.save(summary);

      return {
        id: summary.id,
        summaryType: summary.summaryType,
        summaryCode: summary.summaryCode,
        status: summary.status,
        ticket: summary.ticket,
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

      for (const document of documents) {
        document.status = DocumentStatus.VOIDED;
        await this.documentRepository.save(document);
      }

      return {
        id: summary.id,
        summaryType: summary.summaryType,
        summaryCode: summary.summaryCode,
        status: summary.status,
        ticket: summary.ticket,
        sunat: {
          statusCode: statusResult.statusCode,
          description: statusResult.description,
          accepted: true,
          voidedCount: documents.length,
        },
      };
    }

    summary.status = DailySummaryStatus.REJECTED;
    summary.cdrXml = statusResult.cdrXml;
    summary.errorMessage =
      statusResult.description ?? 'SUNAT rejected voided documents';
    await this.dailySummaryRepository.save(summary);

    for (const document of documents) {
      document.dailySummaryId = null;
      await this.documentRepository.save(document);
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

  private todayIsoDate(): string {
    return getBusinessIsoDate();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
