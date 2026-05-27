import { DocumentSeries } from './entities/document-series.entity';
import { SeriesResponse } from './types/series-response.types';

export function toSeriesResponse(series: DocumentSeries): SeriesResponse {
  return {
    id: series.id,
    docType: series.docType,
    serie: series.serie,
    correlativo: series.correlativo,
    isActive: series.isActive,
    createdAt: series.createdAt,
  };
}
