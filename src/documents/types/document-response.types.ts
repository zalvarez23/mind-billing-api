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
