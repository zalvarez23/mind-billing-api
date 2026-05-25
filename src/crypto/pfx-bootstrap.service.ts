import { Injectable, Logger } from '@nestjs/common';
import * as forge from 'node-forge';
import { access, mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';

@Injectable()
export class PfxBootstrapService {
  private readonly logger = new Logger(PfxBootstrapService.name);

  async ensurePfxFileExists(
    absolutePfxPath: string,
    password: string,
    ruc: string,
    businessName: string,
  ): Promise<void> {
    try {
      await access(absolutePfxPath);
      return;
    } catch {
      this.logger.warn(
        `PFX not found, generating beta file at ${absolutePfxPath}`,
      );
    }

    await mkdir(dirname(absolutePfxPath), { recursive: true });

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

    const pfxDer = forge.pkcs12.toPkcs12Asn1(
      keys.privateKey,
      [cert],
      password,
      { generateLocalKeyId: true, friendlyName: 'mind-billing-dev' },
    );
    const pfxBytes = forge.asn1.toDer(pfxDer).getBytes();
    await writeFile(absolutePfxPath, Buffer.from(pfxBytes, 'binary'));
    this.logger.log(`PFX created at ${absolutePfxPath}`);
  }
}
