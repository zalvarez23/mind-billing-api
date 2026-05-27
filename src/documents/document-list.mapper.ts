import { Document as BillingDocument } from './entities/document.entity';
import {
  DocumentListItemResponse,
  DocumentListClienteSummary,
} from './types/document-response.types';
import { readDocumentPayload } from './types/document-payload.types';

function readClienteSummary(
  payload: Record<string, unknown> | null,
): DocumentListClienteSummary | null {
  const cliente = readDocumentPayload(payload).cliente;
  if (!cliente?.tipoDoc || !cliente?.numDoc) {
    return null;
  }

  return {
    tipoDoc: cliente.tipoDoc,
    numDoc: cliente.numDoc,
    razonSocial: cliente.razonSocial ?? null,
  };
}

export function toDocumentListItemResponse(
  doc: BillingDocument,
): DocumentListItemResponse {
  return {
    id: doc.id,
    docType: doc.docType,
    serie: doc.serie,
    correlativo: doc.correlativo,
    status: doc.status,
    total: doc.total,
    issueDate: doc.issueDate,
    dailySummaryId: doc.dailySummaryId,
    cliente: readClienteSummary(doc.payload),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
