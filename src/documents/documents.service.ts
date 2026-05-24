import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { DocumentStatus } from '../common/enums';
import { User } from '../users/entities/user.entity';
import { DocumentSeries } from '../series/entities/document-series.entity';
import { Document } from './entities/document.entity';
import { SunatSubmission } from './entities/sunat-submission.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceXmlBuilder } from '../ubl/builders/invoice-xml.builder';
import {
  BillServiceClient,
  SendBillResult,
} from '../sunat/bill-service.client';
import { XmlSignatureService } from '../crypto/xml-signature.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { classifySunatSubmissionError } from '../sunat/sunat-error.util';

const INVOICE_DOC_TYPE = '01';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(SunatSubmission)
    private readonly submissionRepository: Repository<SunatSubmission>,
    private readonly invoiceXmlBuilder: InvoiceXmlBuilder,
    private readonly billServiceClient: BillServiceClient,
    private readonly storageService: LocalStorageService,
    private readonly xmlSignatureService: XmlSignatureService,
  ) {}

  async createInvoice(
    company: Company,
    user: User,
    dto: CreateInvoiceDto,
  ): Promise<Record<string, unknown>> {
    const prepared = await this.dataSource.transaction(async (manager) => {
      const seriesRepo = manager.getRepository(DocumentSeries);
      const documentRepo = manager.getRepository(Document);

      const series = await seriesRepo.findOne({
        where: {
          companyId: company.id,
          docType: INVOICE_DOC_TYPE,
          serie: dto.serie,
          isActive: true,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!series) {
        throw new BadRequestException(
          `Series ${dto.serie} not found for invoice type ${INVOICE_DOC_TYPE}`,
        );
      }

      const correlativo = series.correlativo + 1;
      series.correlativo = correlativo;
      await seriesRepo.save(series);

      const now = new Date();
      const issueDate = now.toISOString().slice(0, 10);
      const issueTime = now.toISOString().slice(11, 19);

      const { xml: unsignedXml, totals } = this.invoiceXmlBuilder.build({
        ruc: company.ruc,
        businessName: company.businessName,
        tradeName: company.tradeName,
        address: company.address,
        ubigeo: company.ubigeo,
        serie: dto.serie,
        correlativo,
        tipoOperacion: dto.tipoOperacion,
        moneda: dto.moneda,
        cliente: dto.cliente,
        items: dto.items,
        issueDate,
        issueTime,
        formaPago: dto.formaPago,
      });

      const xml = await this.xmlSignatureService.signInvoiceXml(
        company,
        unsignedXml,
      );

      const fileBaseName = this.invoiceXmlBuilder.getFileBaseName(
        company.ruc,
        dto.serie,
        correlativo,
      );

      const document = await documentRepo.save(
        documentRepo.create({
          companyId: company.id,
          createdById: user.id,
          docType: INVOICE_DOC_TYPE,
          serie: dto.serie,
          correlativo,
          status: DocumentStatus.DRAFT,
          total: totals.total.toFixed(2),
          payload: { ...dto, tipoOperacion: dto.tipoOperacion },
          xmlContent: xml,
        }),
      );

      return {
        document,
        xml,
        fileBaseName,
        xmlFileName: `${fileBaseName}.xml`,
      };
    });

    await this.storageService.saveDocumentFile(
      company.id,
      INVOICE_DOC_TYPE,
      prepared.xmlFileName,
      prepared.xml,
    );

    let sunatResult: SendBillResult;
    let submission: SunatSubmission;

    try {
      prepared.document.status = DocumentStatus.SUBMITTED;
      await this.documentRepository.save(prepared.document);

      sunatResult = await this.billServiceClient.sendBill(
        company,
        prepared.xmlFileName,
        prepared.xml,
      );

      prepared.document.status = sunatResult.accepted
        ? DocumentStatus.ACCEPTED
        : DocumentStatus.REJECTED;
      await this.documentRepository.save(prepared.document);

      submission = await this.submissionRepository.save(
        this.submissionRepository.create({
          documentId: prepared.document.id,
          method: 'sendBill',
          ticket: null,
          statusCode: sunatResult.statusCode,
          cdrXml: sunatResult.cdrXml,
          errorMessage: sunatResult.accepted
            ? null
            : (sunatResult.description ?? 'SUNAT rejected document'),
        }),
      );

      if (sunatResult.cdrXml) {
        await this.storageService.saveDocumentFile(
          company.id,
          INVOICE_DOC_TYPE,
          `R-${prepared.fileBaseName}.xml`,
          sunatResult.cdrXml,
        );
      }
    } catch (error) {
      const classified = classifySunatSubmissionError(error);
      prepared.document.status = classified.status;
      await this.documentRepository.save(prepared.document);

      submission = await this.submissionRepository.save(
        this.submissionRepository.create({
          documentId: prepared.document.id,
          method: 'sendBill',
          ticket: null,
          statusCode: null,
          cdrXml: null,
          errorMessage: classified.errorMessage,
        }),
      );

      throw new BadRequestException({
        message: classified.errorMessage,
        documentId: prepared.document.id,
        status: prepared.document.status,
      });
    }

    return {
      id: prepared.document.id,
      docType: prepared.document.docType,
      serie: prepared.document.serie,
      correlativo: prepared.document.correlativo,
      status: prepared.document.status,
      total: prepared.document.total,
      sunat: {
        statusCode: submission.statusCode,
        description: sunatResult.description,
        accepted: sunatResult.accepted,
        errorMessage: submission.errorMessage,
      },
    };
  }

  async findById(companyId: string, documentId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, companyId },
      relations: { submissions: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    document.submissions?.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return document;
  }

  async getXml(companyId: string, documentId: string): Promise<string> {
    const document = await this.findById(companyId, documentId);

    if (!document.xmlContent) {
      throw new NotFoundException('XML not available for this document');
    }

    return document.xmlContent;
  }

  async getCdr(companyId: string, documentId: string): Promise<string> {
    const document = await this.findById(companyId, documentId);
    const latestSubmission = document.submissions?.[0];

    if (!latestSubmission?.cdrXml) {
      throw new NotFoundException('CDR not available for this document');
    }

    return latestSubmission.cdrXml;
  }
}
