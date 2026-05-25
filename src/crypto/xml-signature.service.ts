import { Injectable } from '@nestjs/common';
import { SignedXml } from 'xml-crypto';
import { Company } from '../companies/entities/company.entity';
import { CompanyCertificateService } from './company-certificate.service';

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

@Injectable()
export class XmlSignatureService {
  constructor(
    private readonly companyCertificateService: CompanyCertificateService,
  ) {}

  signInvoiceXml(company: Company, xml: string): Promise<string> {
    return this.signXml(company, xml, 'Invoice');
  }

  signSummaryXml(company: Company, xml: string): Promise<string> {
    return this.signXml(company, xml, 'SummaryDocuments');
  }

  signCreditNoteXml(company: Company, xml: string): Promise<string> {
    return this.signXml(company, xml, 'CreditNote');
  }

  signDebitNoteXml(company: Company, xml: string): Promise<string> {
    return this.signXml(company, xml, 'DebitNote');
  }

  signVoidedDocumentsXml(company: Company, xml: string): Promise<string> {
    return this.signXml(company, xml, 'VoidedDocuments');
  }

  private async signXml(
    company: Company,
    xml: string,
    rootElement:
      | 'Invoice'
      | 'SummaryDocuments'
      | 'CreditNote'
      | 'DebitNote'
      | 'VoidedDocuments',
  ): Promise<string> {
    const { privateKeyPem, certificatePem } =
      await this.companyCertificateService.getSigningMaterial(company);

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      canonicalizationAlgorithm: C14N,
      getKeyInfoContent: (args) => {
        const p = args?.prefix ? `${args.prefix}:` : 'ds:';
        return `<${p}X509Data><${p}X509Certificate>${this.extractCertificateBody(
          certificatePem,
        )}</${p}X509Certificate></${p}X509Data>`;
      },
    });

    sig.addReference({
      xpath: `/*[local-name(.)='${rootElement}']`,
      transforms: [ENVELOPED, C14N],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      uri: '',
      isEmptyUri: true,
    });

    sig.computeSignature(xml, {
      prefix: 'ds',
      attrs: { Id: 'SignatureSP' },
      location: {
        reference:
          "//*[local-name(.)='ExtensionContent' and namespace-uri(.)='urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2']",
        action: 'append',
      },
    });

    return sig.getSignedXml();
  }

  private extractCertificateBody(certificatePem: string): string {
    return certificatePem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');
  }
}
