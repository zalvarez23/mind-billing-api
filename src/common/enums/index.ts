export enum SunatEnvironment {
  BETA = 'beta',
  HOMOLOGACION = 'homologacion',
  PRODUCTION = 'production',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  SIGNED = 'signed',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  FAILED = 'failed',
  OBSERVED = 'observed',
  VOIDED = 'voided',
  /** Baja local antes de RC; no comunicado a SUNAT. */
  CANCELLED = 'cancelled',
}
