import { BadRequestException } from '@nestjs/common';
import { DocumentStatus } from '../common/enums';
import { SummaryLineInput } from '../ubl/interfaces/summary-build-input.interface';
import { Document } from './entities/document.entity';
import {
  readDocumentPayload,
  type DocumentPayload,
  type RcVoidPayload,
} from './types/document-payload.types';

const CREDIT_NOTE_DOC_TYPE = '07';
const DEBIT_NOTE_DOC_TYPE = '08';

export function buildSummaryLine(
  document: Document,
  lineId: number,
  conditionCode: string,
): SummaryLineInput {
  const payload = readDocumentPayload(document.payload);
  const cliente = payload.cliente;
  const moneda = payload.moneda ?? 'PEN';
  const totals = payload.totals;

  const total = totals?.total ?? Number(document.total);
  const igvTotal =
    totals?.igvTotal ?? Number((total - total / 1.18).toFixed(2));
  const subtotal = totals?.subtotal ?? Number((total - igvTotal).toFixed(2));

  if (!cliente?.tipoDoc || !cliente?.numDoc) {
    throw new BadRequestException(
      `Document ${document.serie}-${document.correlativo} missing customer data for RC`,
    );
  }

  const documentoAfectado = payload.documentoAfectado;

  const billingReference =
    document.docType === CREDIT_NOTE_DOC_TYPE ||
    document.docType === DEBIT_NOTE_DOC_TYPE
      ? documentoAfectado
        ? {
            docType: documentoAfectado.docType,
            serie: documentoAfectado.serie,
            correlativo: documentoAfectado.correlativo,
          }
        : undefined
      : undefined;

  if (
    (document.docType === CREDIT_NOTE_DOC_TYPE ||
      document.docType === DEBIT_NOTE_DOC_TYPE) &&
    !billingReference
  ) {
    throw new BadRequestException(
      `Note ${document.serie}-${document.correlativo} missing documentoAfectado for RC`,
    );
  }

  return {
    lineId,
    docType: document.docType,
    serie: document.serie,
    correlativo: document.correlativo,
    clienteTipoDoc: cliente.tipoDoc,
    clienteNumDoc: cliente.numDoc,
    moneda,
    subtotal,
    igvTotal,
    total,
    conditionCode,
    billingReference,
  };
}

export function isVoidRcXml(xmlContent: string | null): boolean {
  return (
    xmlContent?.includes('<cbc:ConditionCode>3</cbc:ConditionCode>') ?? false
  );
}

export function markBoletaVoidPending(
  boleta: Document,
  voidSummaryId: string,
): void {
  const payload: DocumentPayload = {
    ...readDocumentPayload(boleta.payload),
  };
  const rcVoid: RcVoidPayload = {
    voidSummaryId,
    originalDailySummaryId: boleta.dailySummaryId,
  };
  payload._rcVoid = rcVoid;
  boleta.payload = payload as Record<string, unknown>;
  boleta.dailySummaryId = voidSummaryId;
}

export function finalizeBoletaVoid(
  boleta: Document,
  voidSummaryId: string,
): void {
  const payload: DocumentPayload = {
    ...readDocumentPayload(boleta.payload),
  };
  delete payload._rcVoid;
  boleta.payload = payload as Record<string, unknown>;
  boleta.status = DocumentStatus.VOIDED;
  boleta.dailySummaryId = voidSummaryId;
}

export function revertBoletaVoidPending(boleta: Document): void {
  const rcVoid = readDocumentPayload(boleta.payload)._rcVoid;

  const payload: DocumentPayload = {
    ...readDocumentPayload(boleta.payload),
  };
  delete payload._rcVoid;
  boleta.payload = payload as Record<string, unknown>;
  boleta.dailySummaryId =
    rcVoid?.originalDailySummaryId ?? boleta.dailySummaryId;
}
