import { Company } from '../companies/entities/company.entity';
import { Document as BillingDocument } from './entities/document.entity';
import { readDocumentPayload } from './types/document-payload.types';
import { buildSunatQrText, extractEmisorDigestValue } from './qr-payload.util';

export function resolveDocumentQrText(
  company: Company,
  doc: BillingDocument,
): string | null {
  const payload = readDocumentPayload(doc.payload);
  const totals = payload.totals;
  const totalAmount = totals?.total ?? Number(doc.total);
  const igvAmount = totals?.igvTotal ?? 0;
  const cliente = payload.cliente;

  const digestValue = doc.xmlContent
    ? extractEmisorDigestValue(doc.xmlContent)
    : null;

  if (!digestValue || !doc.issueDate) {
    return null;
  }

  return buildSunatQrText({
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
  });
}
