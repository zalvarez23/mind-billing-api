import { Injectable } from '@nestjs/common';
import { Company } from '../companies/entities/company.entity';
import { XmlSignatureService } from '../crypto/xml-signature.service';
import { SummaryXmlBuilder } from '../ubl/builders/summary-xml.builder';
import { SummaryBuildInput } from '../ubl/interfaces/summary-build-input.interface';

export interface SignedRcXmlResult {
  xml: string;
  summaryCode: string;
  fileBaseName: string;
  xmlFileName: string;
}

@Injectable()
export class DailySummariesXmlHelper {
  constructor(
    private readonly summaryXmlBuilder: SummaryXmlBuilder,
    private readonly xmlSignatureService: XmlSignatureService,
  ) {}

  buildSummaryCode(issueDateYmd: string, correlativo: number): string {
    return this.summaryXmlBuilder.buildSummaryCode(issueDateYmd, correlativo);
  }

  getFileBaseName(
    ruc: string,
    issueDateYmd: string,
    correlativo: number,
  ): string {
    return this.summaryXmlBuilder.getFileBaseName(
      ruc,
      issueDateYmd,
      correlativo,
    );
  }

  async buildSignedRcXml(
    company: Company,
    input: Omit<SummaryBuildInput, 'summaryCode'>,
    issueDateYmd: string,
    correlativo: number,
  ): Promise<SignedRcXmlResult> {
    const summaryCode = this.buildSummaryCode(issueDateYmd, correlativo);
    const unsignedXml = this.summaryXmlBuilder.build({
      ...input,
      summaryCode,
    });
    const xml = await this.xmlSignatureService.signSummaryXml(
      company,
      unsignedXml,
    );
    const fileBaseName = this.getFileBaseName(
      company.ruc,
      issueDateYmd,
      correlativo,
    );

    return {
      xml,
      summaryCode,
      fileBaseName,
      xmlFileName: `${fileBaseName}.xml`,
    };
  }
}
