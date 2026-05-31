import { DailySummary } from './entities/daily-summary.entity';
import {
  DailySummaryDetailResponse,
  DailySummaryResponse,
} from './types/daily-summary-response.types';
import { toDocumentListItemResponse } from './document-list.mapper';

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

export function toDailySummaryDetailResponse(
  summary: DailySummary,
): DailySummaryDetailResponse {
  const documents = (summary.documents ?? [])
    .slice()
    .sort(
      (a, b) =>
        a.docType.localeCompare(b.docType) ||
        a.serie.localeCompare(b.serie) ||
        a.correlativo - b.correlativo,
    )
    .map(toDocumentListItemResponse);

  return {
    ...toDailySummaryResponse(summary, documents.length),
    documents,
  };
}
