import {
  InvoiceBuildInput,
  InvoiceBuildItem,
  InvoiceTotals,
} from './invoice-build-input.interface';

export type BoletaBuildInput = Omit<InvoiceBuildInput, 'tipoOperacion'> & {
  tipoOperacion?: string;
};

export type { InvoiceBuildItem, InvoiceTotals };
