export interface SeriesResponse {
  id: string;
  docType: string;
  serie: string;
  correlativo: number;
  isActive: boolean;
  createdAt: Date;
}

export interface SeriesListResponse {
  data: SeriesResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

