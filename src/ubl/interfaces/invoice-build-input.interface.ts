export interface InvoiceBuildItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  igv?: number;
}

export interface InvoiceBuildInput {
  ruc: string;
  businessName: string;
  tradeName: string | null;
  address: string | null;
  ubigeo: string | null;
  serie: string;
  correlativo: number;
  tipoOperacion: string;
  moneda: string;
  cliente: {
    tipoDoc: string;
    numDoc: string;
    razonSocial: string;
  };
  items: InvoiceBuildItem[];
  issueDate: string;
  issueTime: string;
  formaPago?: string;
}

export interface InvoiceTotals {
  subtotal: number;
  igvTotal: number;
  total: number;
}
