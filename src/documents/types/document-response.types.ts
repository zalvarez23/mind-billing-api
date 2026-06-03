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
  /** Texto pipe listo para QR SUNAT; null sin xml firmado o issueDate. */
  qrText: string | null;
  createdAt: Date;
  updatedAt: Date;
  sunat: DocumentSunatSummary | null;
}
