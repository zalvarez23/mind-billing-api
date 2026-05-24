import { readFile } from 'fs/promises';
import * as forge from 'node-forge';

export interface CertificateMaterial {
  privateKeyPem: string;
  certificatePem: string;
}

export async function loadPfxFromFile(
  pfxPath: string,
  password: string,
): Promise<CertificateMaterial> {
  const pfxBuffer = await readFile(pfxPath);
  const pfxAsn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer));
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags = pfx.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
  });
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;

  if (!cert || !privateKey) {
    throw new Error(`Invalid PFX: ${pfxPath}`);
  }

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificatePem: forge.pki.certificateToPem(cert),
  };
}
