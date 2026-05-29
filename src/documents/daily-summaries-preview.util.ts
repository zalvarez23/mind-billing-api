import type { SummaryLineInput } from '../ubl/interfaces/summary-build-input.interface';
import type {
  DailySummaryPreviewDocumentItem,
  DailySummaryPreviewPaginationMeta,
} from './types/daily-summary-preview.types';
import { Document } from './entities/document.entity';
import { readDocumentPayload } from './types/document-payload.types';

export function paginateArray<T>(
  items: T[],
  page: number,
  limit: number,
): { data: T[]; meta: DailySummaryPreviewPaginationMeta } {
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const start = (page - 1) * limit;

  return {
    data: items.slice(start, start + limit),
    meta: { page, limit, total, totalPages },
  };
}

export function toPreviewDocumentItem(
  document: Document,
  line: SummaryLineInput,
): DailySummaryPreviewDocumentItem {
  const cliente = readDocumentPayload(document.payload).cliente;

  return {
    id: document.id,
    docType: document.docType,
    serie: document.serie,
    correlativo: document.correlativo,
    status: document.status,
    issueDate: document.issueDate,
    lineId: line.lineId,
    conditionCode: line.conditionCode ?? '1',
    moneda: line.moneda,
    subtotal: line.subtotal,
    igvTotal: line.igvTotal,
    total: line.total,
    cliente: {
      tipoDoc: line.clienteTipoDoc,
      numDoc: line.clienteNumDoc,
      razonSocial: cliente?.razonSocial ?? null,
    },
    ...(line.billingReference
      ? { billingReference: line.billingReference }
      : {}),
  };
}

export function aggregatePreviewTotals(lines: SummaryLineInput[]): {
  subtotal: number;
  igvTotal: number;
  total: number;
} {
  return lines.reduce(
    (acc, line) => ({
      subtotal: Number((acc.subtotal + line.subtotal).toFixed(2)),
      igvTotal: Number((acc.igvTotal + line.igvTotal).toFixed(2)),
      total: Number((acc.total + line.total).toFixed(2)),
    }),
    { subtotal: 0, igvTotal: 0, total: 0 },
  );
}
