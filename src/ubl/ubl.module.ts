import { Module } from '@nestjs/common';
import { InvoiceXmlBuilder } from './builders/invoice-xml.builder';

@Module({
  providers: [InvoiceXmlBuilder],
  exports: [InvoiceXmlBuilder],
})
export class UblModule {}
