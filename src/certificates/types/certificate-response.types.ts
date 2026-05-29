export interface CertificateResponse {
  id: string;
  alias: string | null;
  pfxFileName: string | null;
  hasPfxContent: boolean;
  hasPfxPassword: boolean;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface CertificateListResponse {
  data: CertificateResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
