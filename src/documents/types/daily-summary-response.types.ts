import {
  DailySummaryStatus,
  DailySummaryType,
} from '../entities/daily-summary.entity';

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

export interface DailySummaryListResponse {
  data: DailySummaryResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
