import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Company } from '../companies/entities/company.entity';
import { SunatEnvironment } from '../common/enums';
import { buildInvoiceZip, parseCdrZip } from './cdr.parser';
import {
  buildSunatAuthDebugInfo,
  resolveSoapUsername,
} from './sunat-auth-debug.util';

export interface SendBillResult {
  fileName: string;
  statusCode: string | null;
  description: string | null;
  cdrXml: string | null;
  accepted: boolean;
  rawResponse?: string;
}

export interface SendSummaryResult {
  fileName: string;
  ticket: string;
  rawResponse?: string;
}

export interface GetStatusResult {
  statusCode: string | null;
  description: string | null;
  cdrXml: string | null;
  accepted: boolean;
  processing: boolean;
  rawResponse?: string;
}

@Injectable()
export class BillServiceClient {
  private readonly logger = new Logger(BillServiceClient.name);

  constructor(private readonly configService: ConfigService) {}

  logSunatAuthContext(company: Company, context: string): void {
    this.logger.log(
      `[${context}] ${JSON.stringify(buildSunatAuthDebugInfo(company))}`,
    );
  }

  async sendBill(
    company: Company,
    xmlFileName: string,
    xmlContent: string,
  ): Promise<SendBillResult> {
    const zipBuffer = await buildInvoiceZip(xmlFileName, xmlContent);
    const zipFileName = xmlFileName.replace(/\.xml$/i, '.zip');
    const contentFile = zipBuffer.toString('base64');
    const { username, password } = this.resolveCredentials(company);

    this.logger.log(
      `Sending bill to SUNAT (${company.sunatEnvironment}): ${zipFileName}`,
    );

    const responseBody = await this.postSoap(
      company,
      this.buildSendBillEnvelope(zipFileName, contentFile, username, password),
      'urn:sendBill',
    );

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

  async sendSummary(
    company: Company,
    xmlFileName: string,
    xmlContent: string,
  ): Promise<SendSummaryResult> {
    const zipBuffer = await buildInvoiceZip(xmlFileName, xmlContent);
    const zipFileName = xmlFileName.replace(/\.xml$/i, '.zip');
    const contentFile = zipBuffer.toString('base64');
    const { username, password } = this.resolveCredentials(company);

    this.logSunatAuthContext(company, 'sendSummary');
    this.logger.log(
      `Sending summary to SUNAT (${company.sunatEnvironment}): ${zipFileName} xmlBytes=${xmlContent.length}`,
    );

    const responseBody = await this.postSoap(
      company,
      this.buildSendSummaryEnvelope(
        zipFileName,
        contentFile,
        username,
        password,
      ),
      'urn:sendSummary',
    );

    const ticketMatch = responseBody.match(
      /<(?:[\w-]+:)?ticket>([^<]*)<\/(?:[\w-]+:)?ticket>/i,
    );

    if (!ticketMatch?.[1]?.trim()) {
      throw new Error('SUNAT response without ticket');
    }

    return {
      fileName: zipFileName,
      ticket: ticketMatch[1].trim(),
      rawResponse: responseBody,
    };
  }

  async getStatus(company: Company, ticket: string): Promise<GetStatusResult> {
    const { username, password } = this.resolveCredentials(company);

    this.logger.log(
      `Polling SUNAT status (${company.sunatEnvironment}): ticket ${ticket}`,
    );

    const responseBody = await this.postSoap(
      company,
      this.buildGetStatusEnvelope(ticket, username, password),
      'urn:getStatus',
    );

    const statusCodeMatch = responseBody.match(
      /<(?:[\w-]+:)?statusCode>([^<]*)<\/(?:[\w-]+:)?statusCode>/i,
    );
    const statusCode = statusCodeMatch?.[1]?.trim() ?? null;

    if (this.isSunatProcessingStatusCode(statusCode)) {
      return {
        statusCode,
        description: 'En proceso',
        cdrXml: null,
        accepted: false,
        processing: true,
        rawResponse: responseBody,
      };
    }

    const contentMatch = responseBody.match(
      /<(?:[\w-]+:)?content>([^<]+)<\/(?:[\w-]+:)?content>/i,
    );

    if (!contentMatch?.[1]) {
      return {
        statusCode,
        description: 'SUNAT response without content',
        cdrXml: null,
        accepted: false,
        processing: false,
        rawResponse: responseBody,
      };
    }

    const parsed = await parseCdrZip(contentMatch[1]);

    return {
      statusCode: parsed.statusCode ?? statusCode,
      description: parsed.description,
      cdrXml: parsed.cdrXml,
      accepted: parsed.accepted,
      processing: false,
      rawResponse: responseBody,
    };
  }

  private async postSoap(
    company: Company,
    soapEnvelope: string,
    soapAction: string,
  ): Promise<string> {
    const endpoint = this.resolveBillServiceUrl(company.sunatEnvironment);
    const { username } = this.resolveCredentials(company);
    this.logger.log(
      `SUNAT ${soapAction} → env=${company.sunatEnvironment} ruc=${company.ruc} soapUser=${this.maskSoapUsername(username)} endpoint=${endpoint}`,
    );
    const response = await axios.post<string>(endpoint, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: soapAction,
      },
      timeout: this.configService.get<number>('sunat.requestTimeoutMs', 60000),
      validateStatus: () => true,
    });

    const responseBody = response.data;
    const fault = this.extractSoapFault(responseBody);
    if (fault) {
      this.logger.warn(
        `SUNAT ${soapAction} SOAP fault (HTTP ${response.status}): ${fault}`,
      );
      throw new Error(`SUNAT SOAP fault: ${fault}`);
    }

    if (response.status >= 400) {
      this.logger.warn(
        `SUNAT ${soapAction} HTTP ${response.status}: ${responseBody.slice(0, 500)}`,
      );
      throw new Error(
        `SUNAT HTTP ${response.status}: ${responseBody.slice(0, 500)}`,
      );
    }

    this.logger.log(`SUNAT ${soapAction} HTTP ${response.status} OK`);

    return responseBody;
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
      username: resolveSoapUsername(company),
      password: company.solPassword,
    };
  }

  private maskSoapUsername(username: string): string {
    if (username.length <= 15) {
      return username;
    }
    return `${username.slice(0, 11)}...${username.slice(-4)}`;
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

  private buildSendSummaryEnvelope(
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
    <ser:sendSummary>
      <fileName>${fileName}</fileName>
      <contentFile>${contentFile}</contentFile>
    </ser:sendSummary>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private buildGetStatusEnvelope(
    ticket: string,
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
    <ser:getStatus>
      <ticket>${ticket}</ticket>
    </ser:getStatus>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  /** SUNAT may return `98` or zero-padded `0098` while the summary is still processing. */
  private isSunatProcessingStatusCode(statusCode: string | null): boolean {
    if (!statusCode) {
      return false;
    }
    const numeric = Number.parseInt(statusCode, 10);
    return Number.isFinite(numeric) && numeric === 98;
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
