import * as forge from 'node-forge';

/** PFX de desarrollo (beta) generado en memoria; no escribe en disco. */
export function generateDevPfxBuffer(
  ruc: string,
  businessName: string,
  password: string,
): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(
    cert.validity.notBefore.getFullYear() + 2,
  );

  const attrs = [
    { name: 'countryName', value: 'PE' },
    { name: 'organizationName', value: businessName },
    { name: 'commonName', value: ruc },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const pfxDer = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    generateLocalKeyId: true,
    friendlyName: 'mind-billing-dev',
  });
  const pfxBytes = forge.asn1.toDer(pfxDer).getBytes();
  return Buffer.from(pfxBytes, 'binary');
}
