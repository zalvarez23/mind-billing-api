import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Company } from '../companies/entities/company.entity';
import { SunatEnvironment } from '../common/enums';
import { buildInvoiceZip, parseCdrZip } from './cdr.parser';

export interface SendBillResult {
  fileName: string;
  statusCode: string | null;
  description: string | null;
  cdrXml: string | null;
  accepted: boolean;
  rawResponse?: string;
}

@Injectable()
export class BillServiceClient {
  private readonly logger = new Logger(BillServiceClient.name);

  constructor(private readonly configService: ConfigService) {}

  async sendBill(
    company: Company,
    xmlFileName: string,
    xmlContent: string,
  ): Promise<SendBillResult> {
    const zipBuffer = await buildInvoiceZip(xmlFileName, xmlContent);
    const zipFileName = xmlFileName.replace(/\.xml$/i, '.zip');
    const contentFile = zipBuffer.toString('base64');
    const endpoint = this.resolveBillServiceUrl(company.sunatEnvironment);
    const { username, password } = this.resolveCredentials(company);
    const soapEnvelope = this.buildSendBillEnvelope(
      zipFileName,
      contentFile,
      username,
      password,
    );

    this.logger.log(
      `Sending bill to SUNAT (${company.sunatEnvironment}): ${zipFileName}`,
    );

    const response = await axios.post<string>(endpoint, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'urn:sendBill',
      },
      timeout: this.configService.get<number>('sunat.requestTimeoutMs', 60000),
      validateStatus: () => true,
    });

    const responseBody = response.data;

    const fault = this.extractSoapFault(responseBody);
    if (fault) {
      throw new Error(`SUNAT SOAP fault: ${fault}`);
    }

    if (response.status >= 400) {
      throw new Error(
        `SUNAT HTTP ${response.status}: ${responseBody.slice(0, 500)}`,
      );
    }

    const contentMatch = responseBody.match(
      /<(?:[\w-]+:)?applicationResponse>([^<]+)<\/(?:[\w-]+:)?applicationResponse>/i,
    );

    if (!contentMatch?.[1]) {
      throw new Error('SUNAT response without applicationResponse');
    }

    const parsed = await parseCdrZip(contentMatch[1]);

    return {
      fileName: zipFileName,
      statusCode: parsed.statusCode,
      description: parsed.description,
      cdrXml: parsed.cdrXml,
      accepted: parsed.accepted,
      rawResponse: responseBody,
    };
  }

  private resolveBillServiceUrl(environment: SunatEnvironment): string {
    switch (environment) {
      case SunatEnvironment.PRODUCTION:
        return this.configService.get<string>('sunat.billServiceProd')!;
      case SunatEnvironment.HOMOLOGACION:
        return this.configService.get<string>('sunat.billServiceHomologacion')!;
      case SunatEnvironment.BETA:
      default:
        return this.configService.get<string>('sunat.billServiceBeta')!;
    }
  }

  private resolveCredentials(company: Company): {
    username: string;
    password: string;
  } {
    if (company.sunatEnvironment === SunatEnvironment.BETA) {
      return {
        username: company.solUsername ?? `${company.ruc}MODDATOS`,
        password: company.solPassword ?? 'MODDATOS',
      };
    }

    if (!company.solUsername || !company.solPassword) {
      throw new Error('SOL credentials are required outside beta environment');
    }

    return {
      username: company.solUsername,
      password: company.solPassword,
    };
  }

  private buildSendBillEnvelope(
    fileName: string,
    contentFile: string,
    username: string,
    password: string,
  ): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${username}</wsse:Username>
        <wsse:Password>${password}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:sendBill>
      <fileName>${fileName}</fileName>
      <contentFile>${contentFile}</contentFile>
    </ser:sendBill>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private extractSoapFault(responseBody: string): string | null {
    const faultStringMatch = responseBody.match(
      /<faultstring>([^<]*)<\/faultstring>/i,
    );
    if (faultStringMatch?.[1]) {
      return faultStringMatch[1].trim();
    }

    const sunatFaultMatch = responseBody.match(
      /<(?:[\w-]+:)?faultcode>([^<]*)<\/(?:[\w-]+:)?faultcode>[\s\S]*?<(?:[\w-]+:)?faultstring>([^<]*)<\/(?:[\w-]+:)?faultstring>/i,
    );
    if (sunatFaultMatch) {
      return `${sunatFaultMatch[1].trim()}: ${sunatFaultMatch[2].trim()}`;
    }

    return null;
  }
}
