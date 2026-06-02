import { Company } from '../companies/entities/company.entity';
import { Document as BillingDocument } from './entities/document.entity';
import {
  buildSunatQrText,
  extractEmisorDigestValue,
} from './qr-payload.util';
import { DocumentPrintDataResponse } from './types/document-response.types';
import { readDocumentPayload } from './types/document-payload.types';

export function toDocumentPrintDataResponse(
  company: Company,
  doc: BillingDocument,
): DocumentPrintDataResponse {
  const payload = readDocumentPayload(doc.payload);
  const totals = payload.totals;
  const totalAmount = totals?.total ?? Number(doc.total);
  const igvAmount = totals?.igvTotal ?? 0;

  const cliente =
    payload.cliente?.tipoDoc && payload.cliente?.numDoc
      ? {
          tipoDoc: payload.cliente.tipoDoc,
          numDoc: payload.cliente.numDoc,
          razonSocial: payload.cliente.razonSocial ?? null,
        }
      : null;

  const digestValue = doc.xmlContent
    ? extractEmisorDigestValue(doc.xmlContent)
    : null;

  const qrText =
    digestValue && doc.issueDate
      ? buildSunatQrText({
          ruc: company.ruc,
          docType: doc.docType,
          serie: doc.serie,
          correlativo: doc.correlativo,
          igvTotal: igvAmount,
          total: totalAmount,
          issueDate: doc.issueDate,
          clienteTipoDoc: cliente?.tipoDoc,
          clienteNumDoc: cliente?.numDoc,
          digestValue,
        })
      : null;

  return {
    documentId: doc.id,
    ruc: company.ruc,
    docType: doc.docType,
    serie: doc.serie,
    correlativo: doc.correlativo,
    igvTotal: igvAmount.toFixed(2),
    total: totalAmount.toFixed(2),
    issueDate: doc.issueDate,
    status: doc.status,
    cliente,
    digestValue,
    qrText,
  };
}
