import { DailySummary } from './entities/daily-summary.entity';
import { DailySummaryResponse } from './types/daily-summary-response.types';

export function toDailySummaryResponse(
  summary: DailySummary,
  documentCount?: number,
): DailySummaryResponse {
  return {
    id: summary.id,
    summaryType: summary.summaryType,
    summaryCode: summary.summaryCode,
    referenceDate: summary.referenceDate,
    issueDate: summary.issueDate,
    correlativo: summary.correlativo,
    status: summary.status,
    ticket: summary.ticket,
    statusCode: summary.statusCode,
    errorMessage: summary.errorMessage,
    documentCount: documentCount ?? summary.documents?.length ?? 0,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
  };
}
