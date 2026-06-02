import { DocumentStatus } from '../../common/enums';

export interface BoletaCreatedResponse {
  id: string;
  docType: string;
  serie: string;
  correlativo: number;
  status: DocumentStatus;
  total: string;
  issueDate: string | null;
  message: string;
}

export interface NoteCreatedResponse {
  id: string;
  docType: string;
  serie: string;
  correlativo: number;
  status: DocumentStatus;
  total: string;
  issueDate: string | null;
  documentoAfectado?: unknown;
  message?: string;
}

export interface DocumentSunatSummary {
  method: string;
  statusCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface DocumentListClienteSummary {
  tipoDoc: string;
  numDoc: string;
  razonSocial: string | null;
}

export interface DocumentListItemResponse {
  id: string;
  docType: string;
  serie: string;
  correlativo: number;
  status: DocumentStatus;
  total: string;
  issueDate: string | null;
  dailySummaryId: string | null;
  cliente: DocumentListClienteSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentListResponse {
  data: DocumentListItemResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DocumentDetailResponse {
  id: string;
  docType: string;
  serie: string;
  correlativo: number;
  status: DocumentStatus;
  total: string;
  issueDate: string | null;
  dailySummaryId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  sunat: DocumentSunatSummary | null;
}

export interface DocumentPrintCliente {
  tipoDoc: string;
  numDoc: string;
  razonSocial: string | null;
}

/** Datos para representación impresa / QR SUNAT (pipe + DigestValue del XML firmado). */
export interface DocumentPrintDataResponse {
  documentId: string;
  ruc: string;
  docType: string;
  serie: string;
  correlativo: number;
  igvTotal: string;
  total: string;
  issueDate: string | null;
  status: DocumentStatus;
  cliente: DocumentPrintCliente | null;
  /** DigestValue Base64 del XML del emisor; null si no hay xml firmado. */
  digestValue: string | null;
  /** Texto listo para codificar en QR; null si falta xml, digest o issueDate. */
  qrText: string | null;
}
