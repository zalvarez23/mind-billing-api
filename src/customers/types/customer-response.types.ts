export interface CustomerResponse {
  id: string;
  docType: string;
  docNumber: string;
  legalName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  ubigeo: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerListResponse {
  data: CustomerResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
