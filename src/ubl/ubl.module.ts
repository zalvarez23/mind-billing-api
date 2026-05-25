import { Module } from '@nestjs/common';
import { BoletaXmlBuilder } from './builders/boleta-xml.builder';
import { InvoiceXmlBuilder } from './builders/invoice-xml.builder';
import { NoteXmlBuilder } from './builders/note-xml.builder';
import { SummaryXmlBuilder } from './builders/summary-xml.builder';
import { VoidedXmlBuilder } from './builders/voided-xml.builder';

@Module({
  providers: [
    InvoiceXmlBuilder,
    BoletaXmlBuilder,
    NoteXmlBuilder,
    SummaryXmlBuilder,
    VoidedXmlBuilder,
  ],
  exports: [
    InvoiceXmlBuilder,
    BoletaXmlBuilder,
    NoteXmlBuilder,
    SummaryXmlBuilder,
    VoidedXmlBuilder,
  ],
})
export class UblModule {}
