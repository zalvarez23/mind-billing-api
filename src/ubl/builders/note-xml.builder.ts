import { Injectable } from '@nestjs/common';
import {
  InvoiceBuildItem,
  InvoiceTotals,
  NoteBuildInput,
} from '../interfaces/note-build-input.interface';

const IGV_RATE = 0.18;
const DEFAULT_MOTIVO_CODIGO = '01';
const DEFAULT_MOTIVO_DESCRIPCION = 'ANULACION DE LA OPERACION';

const IGV_TAX_SCHEME_XML = `<cac:TaxScheme>
          <cbc:ID schemeID="UN/ECE 5153" schemeName="Tax Scheme Identifier" schemeAgencyName="United Nations Economic Commission for Europe">1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>`;

@Injectable()
export class NoteXmlBuilder {
  buildCreditNote(input: NoteBuildInput): {
    xml: string;
    totals: InvoiceTotals;
  } {
    return this.build(
      input,
      'CreditNote',
      'CreditNoteTypeCode',
      'CreditNoteLine',
    );
  }

  buildDebitNote(input: NoteBuildInput): {
    xml: string;
    totals: InvoiceTotals;
  } {
    // SUNAT DebitNote XSD: no DebitNoteTypeCode (unlike CreditNote + CreditNoteTypeCode).
    return this.build(input, 'DebitNote', null, 'DebitNoteLine');
  }

  getFileBaseName(
    ruc: string,
    noteDocType: '07' | '08',
    serie: string,
    correlativo: number,
  ): string {
    return `${ruc}-${noteDocType}-${serie}-${correlativo}`;
  }

  private build(
    input: NoteBuildInput,
    rootTag: 'CreditNote' | 'DebitNote',
    typeCodeTag: 'CreditNoteTypeCode' | null,
    lineTag: string,
  ): { xml: string; totals: InvoiceTotals } {
    const totals = this.calculateTotals(input.items);
    const noteId = `${input.serie}-${input.correlativo}`;
    const affectedId = `${input.documentoAfectado.serie}-${input.documentoAfectado.correlativo}`;
    const motivoCodigo = input.motivoCodigo ?? DEFAULT_MOTIVO_CODIGO;
    const motivoDescripcion =
      input.motivoDescripcion ?? DEFAULT_MOTIVO_DESCRIPCION;
    const linesXml = input.items
      .map((item, index) =>
        this.buildLine(item, index + 1, input.moneda, lineTag),
      )
      .join('\n');

    const schema =
      rootTag === 'CreditNote'
        ? 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2'
        : 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2';

    const typeCodeXml = typeCodeTag
      ? `  <cbc:${typeCodeTag} listAgencyName="PE:SUNAT" listName="Tipo de Comprobante" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">${input.noteDocType}</cbc:${typeCodeTag}>\n`
      : '';

    const monetaryTotalTag =
      rootTag === 'DebitNote' ? 'RequestedMonetaryTotal' : 'LegalMonetaryTotal';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${rootTag} xmlns="${schema}"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${noteId}</cbc:ID>
  <cbc:IssueDate>${input.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${input.issueTime}</cbc:IssueTime>
${typeCodeXml}  <cbc:DocumentCurrencyCode listAgencyName="United Nations Economic Commission for Europe" listID="ISO 4217 Alpha" listName="Currency">${input.moneda}</cbc:DocumentCurrencyCode>
  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${affectedId}</cbc:ReferenceID>
    <cbc:ResponseCode listAgencyName="PE:SUNAT" listName="Tipo de nota" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo09">${motivoCodigo}</cbc:ResponseCode>
    <cbc:Description>${this.escapeXml(motivoDescripcion)}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${affectedId}</cbc:ID>
      <cbc:DocumentTypeCode>${input.documentoAfectado.docType}</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
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
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${input.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${this.escapeXml(input.businessName)}</cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:ID schemeAgencyName="PE:INEI" schemeName="Ubigeos">${input.ubigeo ?? '150101'}</cbc:ID>
          <cbc:AddressTypeCode listAgencyName="PE:SUNAT" listName="Establecimientos anexos">0000</cbc:AddressTypeCode>
          <cac:AddressLine>
            <cbc:Line>${this.escapeXml(input.address ?? 'Sin dirección')}</cbc:Line>
          </cac:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode listID="ISO 3166-1" listAgencyName="United Nations Economic Commission for Europe" listName="Country">PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${input.cliente.tipoDoc}" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${input.cliente.numDoc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${this.escapeXml(input.cliente.razonSocial)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${input.moneda}">${totals.igvTotal.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${input.moneda}">${totals.subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${input.moneda}">${totals.igvTotal.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        ${IGV_TAX_SCHEME_XML}
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:${monetaryTotalTag}>
    <cbc:PayableAmount currencyID="${input.moneda}">${totals.total.toFixed(2)}</cbc:PayableAmount>
  </cac:${monetaryTotalTag}>
${linesXml}
</${rootTag}>`;

    return { xml, totals };
  }

  private calculateTotals(items: InvoiceBuildItem[]): InvoiceTotals {
    let subtotal = 0;
    let igvTotal = 0;

    for (const item of items) {
      const lineSubtotal = item.cantidad * item.precioUnitario;
      const lineIgv = item.igv ?? Number((lineSubtotal * IGV_RATE).toFixed(2));
      subtotal += lineSubtotal;
      igvTotal += lineIgv;
    }

    subtotal = Number(subtotal.toFixed(2));
    igvTotal = Number(igvTotal.toFixed(2));

    return {
      subtotal,
      igvTotal,
      total: Number((subtotal + igvTotal).toFixed(2)),
    };
  }

  private buildLine(
    item: InvoiceBuildItem,
    lineNumber: number,
    moneda: string,
    lineTag: string,
  ): string {
    const lineSubtotal = Number(
      (item.cantidad * item.precioUnitario).toFixed(2),
    );
    const lineIgv = item.igv ?? Number((lineSubtotal * IGV_RATE).toFixed(2));
    const lineTotal = Number((lineSubtotal + lineIgv).toFixed(2));
    const quantityTag =
      lineTag === 'CreditNoteLine' ? 'CreditedQuantity' : 'DebitedQuantity';

    return `  <cac:${lineTag}>
    <cbc:ID>${lineNumber}</cbc:ID>
    <cbc:${quantityTag} unitCode="NIU">${item.cantidad}</cbc:${quantityTag}>
    <cbc:LineExtensionAmount currencyID="${moneda}">${lineSubtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${moneda}">${lineTotal.toFixed(2)}</cbc:PriceAmount>
        <cbc:PriceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Precio" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16">01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${lineIgv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${lineSubtotal.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">${lineIgv.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>18.00</cbc:Percent>
          <cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">10</cbc:TaxExemptionReasonCode>
          ${IGV_TAX_SCHEME_XML}
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>${this.escapeXml(item.descripcion)}</cbc:Description>
      <cac:SellersItemIdentification>
        <cbc:ID>${this.escapeXml(item.codigo)}</cbc:ID>
      </cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${moneda}">${item.precioUnitario.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:${lineTag}>`;
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
