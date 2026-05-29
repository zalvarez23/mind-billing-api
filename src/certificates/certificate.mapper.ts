import { Certificate } from '../companies/entities/certificate.entity';
import { CertificateResponse } from './types/certificate-response.types';

export function toCertificateResponse(
  certificate: Certificate,
): CertificateResponse {
  const pfxFileName = certificate.pfxPath
    ? certificate.pfxPath.split('/').pop() ?? certificate.pfxPath
    : null;

  return {
    id: certificate.id,
    alias: certificate.alias,
    pfxFileName,
    hasPfxContent: Boolean(certificate.pfxContent?.length),
    hasPfxPassword: Boolean(certificate.pfxPassword),
    validFrom: certificate.validFrom,
    validTo: certificate.validTo,
    isActive: certificate.isActive,
    createdAt: certificate.createdAt,
  };
}
