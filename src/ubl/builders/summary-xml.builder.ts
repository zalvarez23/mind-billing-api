import { Injectable } from '@nestjs/common';
import {
  SummaryBuildInput,
  SummaryLineInput,
} from '../interfaces/summary-build-input.interface';

const IGV_TAX_SCHEME_XML = `<cac:TaxScheme>
            <cbc:ID>1000</cbc:ID>
            <cbc:Name>IGV</cbc:Name>
            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>`;

@Injectable()
export class SummaryXmlBuilder {
  build(input: SummaryBuildInput): string {
    const linesXml = input.lines.map((line) => this.buildLine(line)).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<SummaryDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1"
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
  <cbc:CustomizationID>1.1</cbc:CustomizationID>
  <cbc:ID>${input.summaryCode}</cbc:ID>
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
</SummaryDocuments>`;
  }

  getFileBaseName(
    ruc: string,
    issueDateYmd: string,
    correlativo: number,
  ): string {
    return `${ruc}-RC-${issueDateYmd}-${correlativo}`;
  }

  buildSummaryCode(issueDateYmd: string, correlativo: number): string {
    return `RC-${issueDateYmd}-${correlativo}`;
  }

  private buildLine(line: SummaryLineInput): string {
    const documentId = `${line.serie}-${line.correlativo}`;
    const conditionCode = line.conditionCode ?? '1';
    const billingRefXml = line.billingReference
      ? this.buildBillingReference(line.billingReference)
      : '';

    return `  <sac:SummaryDocumentsLine>
    <cbc:LineID>${line.lineId}</cbc:LineID>
    <cbc:DocumentTypeCode>${line.docType}</cbc:DocumentTypeCode>
    <cbc:ID>${documentId}</cbc:ID>
    <cac:AccountingCustomerParty>
      <cbc:CustomerAssignedAccountID>${this.escapeXml(line.clienteNumDoc)}</cbc:CustomerAssignedAccountID>
      <cbc:AdditionalAccountID>${line.clienteTipoDoc}</cbc:AdditionalAccountID>
    </cac:AccountingCustomerParty>
    ${billingRefXml}
    <cac:Status>
      <cbc:ConditionCode>${conditionCode}</cbc:ConditionCode>
    </cac:Status>
    <sac:TotalAmount currencyID="${line.moneda}">${line.total.toFixed(2)}</sac:TotalAmount>
    <sac:BillingPayment>
      <cbc:PaidAmount currencyID="${line.moneda}">${line.subtotal.toFixed(2)}</cbc:PaidAmount>
      <cbc:InstructionID>01</cbc:InstructionID>
    </sac:BillingPayment>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${line.moneda}">${line.igvTotal.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxAmount currencyID="${line.moneda}">${line.igvTotal.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          ${IGV_TAX_SCHEME_XML}
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
  </sac:SummaryDocumentsLine>`;
  }

  private buildBillingReference(ref: {
    docType: string;
    serie: string;
    correlativo: number;
  }): string {
    const refId = `${ref.serie}-${ref.correlativo}`;
    return `<cac:BillingReference>
      <cac:InvoiceDocumentReference>
        <cbc:ID>${refId}</cbc:ID>
        <cbc:DocumentTypeCode>${ref.docType}</cbc:DocumentTypeCode>
      </cac:InvoiceDocumentReference>
    </cac:BillingReference>`;
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
