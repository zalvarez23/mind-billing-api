export interface SummaryBillingReference {
  docType: string;
  serie: string;
  correlativo: number;
}

export interface SummaryLineInput {
  lineId: number;
  docType: string;
  serie: string;
  correlativo: number;
  clienteTipoDoc: string;
  clienteNumDoc: string;
  moneda: string;
  subtotal: number;
  igvTotal: number;
  total: number;
  conditionCode?: string;
  billingReference?: SummaryBillingReference;
}

export interface SummaryBuildInput {
  ruc: string;
  businessName: string;
  summaryCode: string;
  referenceDate: string;
  issueDate: string;
  lines: SummaryLineInput[];
}
