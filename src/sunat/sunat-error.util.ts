import { DocumentStatus } from '../common/enums';

export interface ClassifiedSunatError {
  status: DocumentStatus.REJECTED | DocumentStatus.FAILED;
  errorMessage: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown SUNAT error';
}

function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = 'code' in error ? String(error.code) : '';
  return ['ECONNABORTED', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(
    code,
  );
}

export function classifySunatSubmissionError(
  error: unknown,
): ClassifiedSunatError {
  const errorMessage = getErrorMessage(error);

  if (isNetworkError(error)) {
    return { status: DocumentStatus.FAILED, errorMessage };
  }

  if (
    errorMessage.includes('SUNAT HTTP') ||
    errorMessage.includes('SUNAT response without applicationResponse')
  ) {
    return { status: DocumentStatus.FAILED, errorMessage };
  }

  if (errorMessage.startsWith('SUNAT SOAP fault:')) {
    return { status: DocumentStatus.REJECTED, errorMessage };
  }

  return { status: DocumentStatus.FAILED, errorMessage };
}
