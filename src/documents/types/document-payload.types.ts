export interface RcVoidPayload {
  voidSummaryId: string;
  originalDailySummaryId: string | null;
}

export interface DocumentPayload {
  cliente?: { tipoDoc: string; numDoc: string; razonSocial?: string };
  moneda?: string;
  totals?: { subtotal: number; igvTotal: number; total: number };
  documentoAfectado?: {
    docType: string;
    serie: string;
    correlativo: number;
  };
  _rcVoid?: RcVoidPayload;
}

export function readDocumentPayload(
  payload: Record<string, unknown> | null,
): DocumentPayload {
  return payload ?? {};
}

export function hasRcVoidInProgress(
  payload: Record<string, unknown> | null,
): boolean {
  return readDocumentPayload(payload)._rcVoid !== undefined;
}
