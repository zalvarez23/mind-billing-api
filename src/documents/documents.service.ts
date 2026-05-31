import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { DocumentStatus } from '../common/enums';
import { User } from '../users/entities/user.entity';
import { DocumentSeries } from '../series/entities/document-series.entity';
import { Document } from './entities/document.entity';
import { SunatSubmission } from './entities/sunat-submission.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateBoletaDto } from './dto/create-boleta.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { BoletaXmlBuilder } from '../ubl/builders/boleta-xml.builder';
import { InvoiceXmlBuilder } from '../ubl/builders/invoice-xml.builder';
import { NoteXmlBuilder } from '../ubl/builders/note-xml.builder';
import { NoteBuildInput } from '../ubl/interfaces/note-build-input.interface';
import {
  BillServiceClient,
  SendBillResult,
} from '../sunat/bill-service.client';
import { XmlSignatureService } from '../crypto/xml-signature.service';
import { classifySunatSubmissionError } from '../sunat/sunat-error.util';
import { getBusinessDateTime } from '../common/date-time.util';
import {
  BoletaCreatedResponse,
  DocumentListResponse,
  NoteCreatedResponse,
} from './types/document-response.types';
import { toDocumentListItemResponse } from './document-list.mapper';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { CancelDocumentsDto } from './dto/cancel-documents.dto';
import { markDocumentCancelled } from './types/document-payload.types';

const INVOICE_DOC_TYPE = '01';
const BOLETA_DOC_TYPE = '03';
const CREDIT_NOTE_DOC_TYPE = '07';
const DEBIT_NOTE_DOC_TYPE = '08';
const RC_PENDING_DOC_TYPES = [
  BOLETA_DOC_TYPE,
  CREDIT_NOTE_DOC_TYPE,
  DEBIT_NOTE_DOC_TYPE,
] as const;
const IGV_RATE = 0.18;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(SunatSubmission)
    private readonly submissionRepository: Repository<SunatSubmission>,
    private readonly invoiceXmlBuilder: InvoiceXmlBuilder,
    private readonly boletaXmlBuilder: BoletaXmlBuilder,
    private readonly noteXmlBuilder: NoteXmlBuilder,
    private readonly billServiceClient: BillServiceClient,
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

      const { issueDate, issueTime } = getBusinessDateTime();

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
          payload: {
            ...dto,
            items: this.withComputedIgv(dto.items),
            totals,
            cliente: dto.cliente,
            moneda: dto.moneda,
            tipoOperacion: dto.tipoOperacion,
          },
          issueDate,
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

  async createBoleta(
    company: Company,
    user: User,
    dto: CreateBoletaDto,
  ): Promise<BoletaCreatedResponse> {
    const prepared = await this.dataSource.transaction(async (manager) => {
      const seriesRepo = manager.getRepository(DocumentSeries);
      const documentRepo = manager.getRepository(Document);

      const series = await seriesRepo.findOne({
        where: {
          companyId: company.id,
          docType: BOLETA_DOC_TYPE,
          serie: dto.serie,
          isActive: true,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!series) {
        throw new BadRequestException(
          `Series ${dto.serie} not found for boleta type ${BOLETA_DOC_TYPE}`,
        );
      }

      const correlativo = series.correlativo + 1;
      series.correlativo = correlativo;
      await seriesRepo.save(series);

      const { issueDate, issueTime } = getBusinessDateTime();

      const { xml: unsignedXml, totals } = this.boletaXmlBuilder.build({
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

      const fileBaseName = this.boletaXmlBuilder.getFileBaseName(
        company.ruc,
        dto.serie,
        correlativo,
      );

      const document = await documentRepo.save(
        documentRepo.create({
          companyId: company.id,
          createdById: user.id,
          docType: BOLETA_DOC_TYPE,
          serie: dto.serie,
          correlativo,
          status: DocumentStatus.SIGNED,
          total: totals.total.toFixed(2),
          issueDate,
          payload: {
            ...dto,
            items: this.withComputedIgv(dto.items),
            totals,
            cliente: dto.cliente,
            moneda: dto.moneda,
          },
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

    return {
      id: prepared.document.id,
      docType: prepared.document.docType,
      serie: prepared.document.serie,
      correlativo: prepared.document.correlativo,
      status: prepared.document.status,
      total: prepared.document.total,
      issueDate: prepared.document.issueDate,
      message:
        'Boleta signed locally. Submit daily summary (RC) before end of day.',
    };
  }

  async createCreditNote(
    company: Company,
    user: User,
    dto: CreateNoteDto,
  ): Promise<NoteCreatedResponse | Record<string, unknown>> {
    return this.createNote(company, user, dto, CREDIT_NOTE_DOC_TYPE);
  }

  async createDebitNote(
    company: Company,
    user: User,
    dto: CreateNoteDto,
  ): Promise<NoteCreatedResponse | Record<string, unknown>> {
    return this.createNote(company, user, dto, DEBIT_NOTE_DOC_TYPE);
  }

  private async createNote(
    company: Company,
    user: User,
    dto: CreateNoteDto,
    noteDocType: typeof CREDIT_NOTE_DOC_TYPE | typeof DEBIT_NOTE_DOC_TYPE,
  ): Promise<NoteCreatedResponse | Record<string, unknown>> {
    const affected = await this.documentRepository.findOne({
      where: { id: dto.documentoAfectadoId, companyId: company.id },
    });

    if (!affected) {
      throw new NotFoundException('Affected document not found');
    }

    if (
      affected.docType !== INVOICE_DOC_TYPE &&
      affected.docType !== BOLETA_DOC_TYPE
    ) {
      throw new BadRequestException(
        'Notes can only reference invoices (01) or boletas (03)',
      );
    }

    if (
      affected.docType === INVOICE_DOC_TYPE &&
      affected.status !== DocumentStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        'Credit/debit notes for invoices require an accepted invoice',
      );
    }

    if (
      affected.docType === BOLETA_DOC_TYPE &&
      affected.status !== DocumentStatus.SIGNED &&
      affected.status !== DocumentStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        'Credit/debit notes for boletas require a signed or accepted boleta',
      );
    }

    const prepared = await this.dataSource.transaction(async (manager) => {
      const seriesRepo = manager.getRepository(DocumentSeries);
      const documentRepo = manager.getRepository(Document);

      const series = await seriesRepo.findOne({
        where: {
          companyId: company.id,
          docType: noteDocType,
          serie: dto.serie,
          isActive: true,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!series) {
        throw new BadRequestException(
          `Series ${dto.serie} not found for note type ${noteDocType}`,
        );
      }

      const correlativo = series.correlativo + 1;
      series.correlativo = correlativo;
      await seriesRepo.save(series);

      const { issueDate, issueTime } = getBusinessDateTime();

      const noteInput: NoteBuildInput = {
        ruc: company.ruc,
        businessName: company.businessName,
        address: company.address,
        ubigeo: company.ubigeo,
        serie: dto.serie,
        correlativo,
        noteDocType,
        moneda: dto.moneda,
        cliente: dto.cliente,
        items: dto.items,
        issueDate,
        issueTime,
        documentoAfectado: {
          docType: affected.docType,
          serie: affected.serie,
          correlativo: affected.correlativo,
        },
        motivoCodigo: dto.motivoCodigo,
        motivoDescripcion: dto.motivoDescripcion,
      };

      const buildResult =
        noteDocType === CREDIT_NOTE_DOC_TYPE
          ? this.noteXmlBuilder.buildCreditNote(noteInput)
          : this.noteXmlBuilder.buildDebitNote(noteInput);

      const xml =
        noteDocType === CREDIT_NOTE_DOC_TYPE
          ? await this.xmlSignatureService.signCreditNoteXml(
              company,
              buildResult.xml,
            )
          : await this.xmlSignatureService.signDebitNoteXml(
              company,
              buildResult.xml,
            );

      const fileBaseName = this.noteXmlBuilder.getFileBaseName(
        company.ruc,
        noteDocType,
        dto.serie,
        correlativo,
      );

      const documentoAfectado = {
        id: affected.id,
        docType: affected.docType,
        serie: affected.serie,
        correlativo: affected.correlativo,
        issueDate: affected.issueDate,
      };

      const document = await documentRepo.save(
        documentRepo.create({
          companyId: company.id,
          createdById: user.id,
          docType: noteDocType,
          serie: dto.serie,
          correlativo,
          status:
            affected.docType === BOLETA_DOC_TYPE
              ? DocumentStatus.SIGNED
              : DocumentStatus.DRAFT,
          total: buildResult.totals.total.toFixed(2),
          issueDate,
          payload: {
            ...dto,
            totals: buildResult.totals,
            cliente: dto.cliente,
            moneda: dto.moneda,
            documentoAfectado,
          },
          xmlContent: xml,
        }),
      );

      return {
        document,
        affected,
        xml,
        fileBaseName,
        xmlFileName: `${fileBaseName}.xml`,
        totals: buildResult.totals,
      };
    });

    if (prepared.affected.docType === BOLETA_DOC_TYPE) {
      return {
        id: prepared.document.id,
        docType: prepared.document.docType,
        serie: prepared.document.serie,
        correlativo: prepared.document.correlativo,
        status: prepared.document.status,
        total: prepared.document.total,
        issueDate: prepared.document.issueDate,
        documentoAfectado: prepared.document.payload?.documentoAfectado,
        message:
          'Note signed locally. Include it in the daily summary (RC) for the same reference date.',
      };
    }

    return this.submitSendBill(
      company,
      prepared.document,
      prepared.xmlFileName,
      prepared.xml,
    );
  }

  private async submitSendBill(
    company: Company,
    document: Document,
    xmlFileName: string,
    xml: string,
  ): Promise<Record<string, unknown>> {
    let sunatResult: SendBillResult;
    let submission: SunatSubmission;

    try {
      document.status = DocumentStatus.SUBMITTED;
      await this.documentRepository.save(document);

      sunatResult = await this.billServiceClient.sendBill(
        company,
        xmlFileName,
        xml,
      );

      document.status = sunatResult.accepted
        ? DocumentStatus.ACCEPTED
        : DocumentStatus.REJECTED;
      await this.documentRepository.save(document);

      submission = await this.submissionRepository.save(
        this.submissionRepository.create({
          documentId: document.id,
          method: 'sendBill',
          ticket: null,
          statusCode: sunatResult.statusCode,
          cdrXml: sunatResult.cdrXml,
          errorMessage: sunatResult.accepted
            ? null
            : (sunatResult.description ?? 'SUNAT rejected document'),
        }),
      );
    } catch (error) {
      const classified = classifySunatSubmissionError(error);
      document.status = classified.status;
      await this.documentRepository.save(document);

      submission = await this.submissionRepository.save(
        this.submissionRepository.create({
          documentId: document.id,
          method: 'sendBill',
          ticket: null,
          statusCode: null,
          cdrXml: null,
          errorMessage: classified.errorMessage,
        }),
      );

      throw new BadRequestException({
        message: classified.errorMessage,
        documentId: document.id,
        status: document.status,
      });
    }

    return {
      id: document.id,
      docType: document.docType,
      serie: document.serie,
      correlativo: document.correlativo,
      status: document.status,
      total: document.total,
      sunat: {
        statusCode: submission.statusCode,
        description: sunatResult.description,
        accepted: sunatResult.accepted,
        errorMessage: submission.errorMessage,
      },
    };
  }

  async findAll(
    companyId: string,
    query: ListDocumentsQueryDto,
  ): Promise<DocumentListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.documentRepository
      .createQueryBuilder('doc')
      .where('doc.companyId = :companyId', { companyId });

    if (query.issueDate) {
      qb.andWhere('doc.issueDate = :issueDate', { issueDate: query.issueDate });
    } else {
      if (query.from) {
        qb.andWhere('doc.issueDate >= :from', { from: query.from });
      }
      if (query.to) {
        qb.andWhere('doc.issueDate <= :to', { to: query.to });
      }
    }

    if (query.docType) {
      qb.andWhere('doc.docType = :docType', { docType: query.docType });
    }

    if (query.status) {
      qb.andWhere('doc.status = :status', { status: query.status });
    }

    if (query.serie) {
      qb.andWhere('doc.serie = :serie', { serie: query.serie });
    }

    if (query.pendingRc) {
      qb.andWhere('doc.status = :signedStatus', {
        signedStatus: DocumentStatus.SIGNED,
      })
        .andWhere('doc.dailySummaryId IS NULL')
        .andWhere('doc.docType IN (:...pendingRcDocTypes)', {
          pendingRcDocTypes: [
            BOLETA_DOC_TYPE,
            CREDIT_NOTE_DOC_TYPE,
            DEBIT_NOTE_DOC_TYPE,
          ],
        });
    }

    if (query.q) {
      qb.andWhere(
        `(
          doc.serie ILIKE :q
          OR CAST(doc.correlativo AS TEXT) ILIKE :q
          OR CONCAT(doc.serie, '-', doc.correlativo) ILIKE :q
          OR doc.payload->'cliente'->>'numDoc' ILIKE :q
          OR doc.payload->'cliente'->>'razonSocial' ILIKE :q
          OR CAST(doc.id AS TEXT) ILIKE :q
        )`,
        { q: `%${query.q}%` },
      );
    }

    qb.orderBy('doc.createdAt', 'DESC')
      .addOrderBy('doc.serie', 'ASC')
      .addOrderBy('doc.correlativo', 'ASC');

    const [documents, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: documents.map(toDocumentListItemResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async cancelSignedDocuments(
    companyId: string,
    user: User,
    dto: CancelDocumentsDto,
  ): Promise<{
    cancelled: Array<{
      id: string;
      docType: string;
      serie: string;
      correlativo: number;
      status: DocumentStatus;
      cancellation: {
        cancelledBy: string;
        cancelledAt: string;
        cancelReason: string | null;
      };
    }>;
    count: number;
  }> {
    const documents = await this.documentRepository.find({
      where: {
        id: In(dto.documentIds),
        companyId,
        docType: In([...RC_PENDING_DOC_TYPES]),
        status: DocumentStatus.SIGNED,
        dailySummaryId: IsNull(),
      },
    });

    if (documents.length !== dto.documentIds.length) {
      throw new BadRequestException(
        'All documentIds must be signed boletas/notes (03/07/08) without RC for this company',
      );
    }

    const cancelledAt = new Date().toISOString();
    const cancellation = {
      cancelledBy: user.id,
      cancelledAt,
      cancelReason: dto.cancelReason?.trim() ?? null,
    };

    const cancelled: Array<{
      id: string;
      docType: string;
      serie: string;
      correlativo: number;
      status: DocumentStatus;
      cancellation: {
        cancelledBy: string;
        cancelledAt: string;
        cancelReason: string | null;
      };
    }> = [];

    for (const document of documents) {
      markDocumentCancelled(document, cancellation);
      document.status = DocumentStatus.CANCELLED;
      await this.documentRepository.save(document);
      cancelled.push({
        id: document.id,
        docType: document.docType,
        serie: document.serie,
        correlativo: document.correlativo,
        status: document.status,
        cancellation,
      });
    }

    return { cancelled, count: cancelled.length };
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

  private withComputedIgv<
    T extends { cantidad: number; precioUnitario: number; igv?: number },
  >(items: T[]): Array<T & { igv: number }> {
    return items.map((item) => {
      const subtotal = item.cantidad * item.precioUnitario;
      const igv = item.igv ?? Number((subtotal * IGV_RATE).toFixed(2));
      return { ...item, igv };
    });
  }
}
