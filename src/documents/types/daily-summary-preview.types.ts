import type { SummaryLineInput } from '../../ubl/interfaces/summary-build-input.interface';

export interface DailySummaryPreviewPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DailySummaryPreviewDocumentItem {
  id: string;
  docType: string;
  serie: string;
  correlativo: number;
  status: string;
  issueDate: string | null;
  lineId: number;
  conditionCode: string;
  moneda: string;
  subtotal: number;
  igvTotal: number;
  total: number;
  cliente: {
    tipoDoc: string;
    numDoc: string;
    razonSocial: string | null;
  };
  billingReference?: {
    docType: string;
    serie: string;
    correlativo: number;
  };
}

export interface DailySummaryPreviewWarning {
  code: string;
  message: string;
  dailySummaryId?: string;
  ticket?: string;
  status?: string;
}

export interface DailySummaryPreviewFiles {
  xmlFileName: string;
  zipFileName: string;
  xmlSizeBytes: number;
}

export interface DailySummaryPreviewTotals {
  documentCount: number;
  subtotal: number;
  igvTotal: number;
  total: number;
}

export interface DailySummaryPreviewResponse {
  variant: 'alta' | 'void';
  summaryType: 'RC';
  referenceDate: string;
  issueDate: string;
  summaryCode: string | null;
  correlativo: number | null;
  conditionCode: string;
  documentCount: number;
  blockedDocumentCount?: number;
  totals: DailySummaryPreviewTotals | null;
  files: DailySummaryPreviewFiles | null;
  lines: SummaryLineInput[] | null;
  xml: string | null;
  warnings: DailySummaryPreviewWarning[];
  documents: {
    data: DailySummaryPreviewDocumentItem[];
    meta: DailySummaryPreviewPaginationMeta;
  };
}
