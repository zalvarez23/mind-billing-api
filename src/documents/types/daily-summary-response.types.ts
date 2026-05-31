import {
  DailySummaryStatus,
  DailySummaryType,
} from '../entities/daily-summary.entity';
import { DocumentListItemResponse } from './document-response.types';

export interface DailySummaryResponse {
  id: string;
  summaryType: DailySummaryType;
  summaryCode: string;
  referenceDate: string;
  issueDate: string;
  correlativo: number;
  status: DailySummaryStatus;
  ticket: string | null;
  statusCode: string | null;
  errorMessage: string | null;
  documentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailySummaryDetailResponse extends DailySummaryResponse {
  documents: DocumentListItemResponse[];
}

export interface DailySummaryListResponse {
  data: DailySummaryResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
