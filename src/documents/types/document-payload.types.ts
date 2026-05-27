export interface RcVoidPayload {
  voidSummaryId: string;
  originalDailySummaryId: string | null;
}

export interface DocumentCancellationPayload {
  cancelledBy: string;
  cancelledAt: string;
  cancelReason: string | null;
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
  cancellation?: DocumentCancellationPayload;
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

export function markDocumentCancelled(
  document: { payload: Record<string, unknown> | null },
  cancellation: DocumentCancellationPayload,
): void {
  const payload: DocumentPayload = {
    ...readDocumentPayload(document.payload),
    cancellation,
  };
  document.payload = payload as Record<string, unknown>;
}
