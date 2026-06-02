/**
 * SUNAT representación impresa — QR con separador pipe (Anexo RS 113-2018 / RS 185-2015).
 * Orden: RUC|tipo|serie|número|IGV|total|fecha|tipoDocCliente|numDocCliente|valorResumen
 */

export interface SunatQrPayloadInput {
  ruc: string;
  docType: string;
  serie: string;
  correlativo: number;
  igvTotal: number;
  total: number;
  issueDate: string;
  clienteTipoDoc?: string | null;
  clienteNumDoc?: string | null;
  digestValue: string;
}

export function extractEmisorDigestValue(signedXml: string): string | null {
  const match = signedXml.match(
    /<(?:[\w-]+:)?DigestValue>([^<]+)<\/(?:[\w-]+:)?DigestValue>/i,
  );
  const value = match?.[1]?.trim();
  return value || null;
}

export function formatSunatQrAmount(amount: number): string {
  return amount.toFixed(2);
}

export function buildSunatQrText(input: SunatQrPayloadInput): string {
  const clienteTipo = input.clienteTipoDoc?.trim() ?? '';
  const clienteNum = input.clienteNumDoc?.trim() ?? '';

  return [
    input.ruc,
    input.docType,
    input.serie,
    String(input.correlativo),
    formatSunatQrAmount(input.igvTotal),
    formatSunatQrAmount(input.total),
    input.issueDate,
    clienteTipo,
    clienteNum,
    input.digestValue,
  ].join('|');
}
