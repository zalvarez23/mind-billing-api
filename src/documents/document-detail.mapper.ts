import { Company } from '../companies/entities/company.entity';
import { Document as BillingDocument } from './entities/document.entity';
import { resolveDocumentQrText } from './document-qr-text.util';
import { DocumentDetailResponse } from './types/document-response.types';

export function toDocumentDetailResponse(
  company: Company,
  doc: BillingDocument,
): DocumentDetailResponse {
  const latestSubmission = doc.submissions?.[0];

  return {
    id: doc.id,
    docType: doc.docType,
    serie: doc.serie,
    correlativo: doc.correlativo,
    status: doc.status,
    total: doc.total,
    issueDate: doc.issueDate,
    dailySummaryId: doc.dailySummaryId,
    payload: doc.payload,
    qrText: resolveDocumentQrText(company, doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
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
