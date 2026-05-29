import * as forge from 'node-forge';
import { loadPfxFromBuffer } from './pfx-loader';

export interface PfxMetadata {
  validFrom: string;
  validTo: string;
  subjectCommonName: string | null;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function extractPfxMetadata(
  pfxBuffer: Buffer,
  password: string,
): PfxMetadata {
  loadPfxFromBuffer(pfxBuffer, password);

  const pfxAsn1 = forge.asn1.fromDer(
    forge.util.createBuffer(pfxBuffer.toString('binary')),
  );
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;

  if (!cert) {
    throw new Error('PFX does not contain a certificate');
  }

  const cn = cert.subject.getField('CN')?.value;
  const subjectCommonName =
    typeof cn === 'string' ? cn : cn != null ? String(cn) : null;

  return {
    validFrom: toIsoDate(cert.validity.notBefore),
    validTo: toIsoDate(cert.validity.notAfter),
    subjectCommonName,
  };
}
