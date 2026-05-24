import JSZip from 'jszip';

export interface ParsedCdr {
  statusCode: string | null;
  description: string | null;
  cdrXml: string | null;
  accepted: boolean;
}

export async function buildInvoiceZip(
  xmlFileName: string,
  xmlContent: string,
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(xmlFileName, xmlContent);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function parseCdrZip(base64Zip: string): Promise<ParsedCdr> {
  const zipBuffer = Buffer.from(base64Zip, 'base64');
  const zip = await JSZip.loadAsync(zipBuffer);
  const xmlFile = Object.values(zip.files).find(
    (file) => !file.dir && file.name.toLowerCase().endsWith('.xml'),
  );

  if (!xmlFile) {
    return {
      statusCode: null,
      description: 'CDR without XML',
      cdrXml: null,
      accepted: false,
    };
  }

  const cdrXml = await xmlFile.async('string');
  const codeMatch = cdrXml.match(
    /<(?:[\w-]+:)?ResponseCode>([^<]*)<\/(?:[\w-]+:)?ResponseCode>/i,
  );
  const descMatch = cdrXml.match(
    /<(?:[\w-]+:)?Description>([^<]*)<\/(?:[\w-]+:)?Description>/i,
  );

  const statusCode = codeMatch?.[1]?.trim() ?? null;
  const description = descMatch?.[1]?.trim() ?? null;
  const accepted = statusCode === '0';

  return { statusCode, description, cdrXml, accepted };
}
