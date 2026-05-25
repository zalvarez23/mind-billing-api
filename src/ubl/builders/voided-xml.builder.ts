import { Injectable } from '@nestjs/common';
import {
  VoidedBuildInput,
  VoidedLineInput,
} from '../interfaces/voided-build-input.interface';

@Injectable()
export class VoidedXmlBuilder {
  build(input: VoidedBuildInput): string {
    const linesXml = input.lines.map((line) => this.buildLine(line)).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<VoidedDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>${input.voidedCode}</cbc:ID>
  <cbc:ReferenceDate>${input.referenceDate}</cbc:ReferenceDate>
  <cbc:IssueDate>${input.issueDate}</cbc:IssueDate>
  <cac:Signature>
    <cbc:ID>IDSignKG</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${input.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${this.escapeXml(input.businessName)}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#SignatureSP</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>${input.ruc}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${this.escapeXml(input.businessName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
${linesXml}
</VoidedDocuments>`;
  }

  getFileBaseName(
    ruc: string,
    issueDateYmd: string,
    correlativo: number,
  ): string {
    return `${ruc}-RA-${issueDateYmd}-${correlativo}`;
  }

  buildVoidedCode(issueDateYmd: string, correlativo: number): string {
    return `RA-${issueDateYmd}-${correlativo}`;
  }

  private buildLine(line: VoidedLineInput): string {
    return `  <sac:VoidedDocumentsLine>
    <cbc:LineID>${line.lineId}</cbc:LineID>
    <cbc:DocumentTypeCode>${line.docType}</cbc:DocumentTypeCode>
    <sac:DocumentSerialID>${line.serie}</sac:DocumentSerialID>
    <sac:DocumentNumberID>${line.correlativo}</sac:DocumentNumberID>
    <sac:VoidReasonDescription>${this.escapeXml(line.motivoBaja)}</sac:VoidReasonDescription>
  </sac:VoidedDocumentsLine>`;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
