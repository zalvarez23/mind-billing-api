import {
  InvoiceBuildItem,
  InvoiceTotals,
} from './invoice-build-input.interface';

export interface DocumentoAfectadoRef {
  docType: string;
  serie: string;
  correlativo: number;
}

export interface NoteBuildInput {
  ruc: string;
  businessName: string;
  address: string | null;
  ubigeo: string | null;
  serie: string;
  correlativo: number;
  noteDocType: '07' | '08';
  moneda: string;
  cliente: {
    tipoDoc: string;
    numDoc: string;
    razonSocial: string;
  };
  items: InvoiceBuildItem[];
  issueDate: string;
  issueTime: string;
  documentoAfectado: DocumentoAfectadoRef;
  motivoCodigo?: string;
  motivoDescripcion?: string;
}

export type { InvoiceBuildItem, InvoiceTotals };
