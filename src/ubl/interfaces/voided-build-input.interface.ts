export interface VoidedLineInput {
  lineId: number;
  docType: string;
  serie: string;
  correlativo: number;
  motivoBaja: string;
}

export interface VoidedBuildInput {
  ruc: string;
  businessName: string;
  voidedCode: string;
  referenceDate: string;
  issueDate: string;
  lines: VoidedLineInput[];
}
