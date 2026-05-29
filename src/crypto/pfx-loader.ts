import * as forge from 'node-forge';

export interface CertificateMaterial {
  privateKeyPem: string;
  certificatePem: string;
}

export function loadPfxFromBuffer(
  pfxBuffer: Buffer,
  password: string,
): CertificateMaterial {
  const pfxAsn1 = forge.asn1.fromDer(
    forge.util.createBuffer(pfxBuffer.toString('binary')),
  );
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags = pfx.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
  });
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;

  if (!cert || !privateKey) {
    throw new Error('Invalid PFX buffer');
  }

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificatePem: forge.pki.certificateToPem(cert),
  };
}
