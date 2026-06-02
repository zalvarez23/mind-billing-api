import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildSunatQrText,
  extractEmisorDigestValue,
} from './qr-payload.util';

describe('qr-payload.util', () => {
  const boletaXmlPath = join(
    __dirname,
    '../../storage/00000000-0000-4000-8000-000000000001/03/20000000001-03-B001-2.xml',
  );

  it('extracts DigestValue from signed invoice XML', () => {
    const xml = readFileSync(boletaXmlPath, 'utf8');
    expect(extractEmisorDigestValue(xml)).toBe(
      'zONmdNTsJRPmT3rtFiZmlyy+K5Diwry6/+sivUVYcvQ=',
    );
  });

  it('builds pipe-separated SUNAT QR text', () => {
    const qr = buildSunatQrText({
      ruc: '20000000001',
      docType: '03',
      serie: 'B001',
      correlativo: 2,
      igvTotal: 18,
      total: 118,
      issueDate: '2026-05-24',
      clienteTipoDoc: '1',
      clienteNumDoc: '12345678',
      digestValue: 'zONmdNTsJRPmT3rtFiZmlyy+K5Diwry6/+sivUVYcvQ=',
    });

    expect(qr).toBe(
      '20000000001|03|B001|2|18.00|118.00|2026-05-24|1|12345678|zONmdNTsJRPmT3rtFiZmlyy+K5Diwry6/+sivUVYcvQ=',
    );
  });

  it('uses empty cliente fields when not provided', () => {
    const qr = buildSunatQrText({
      ruc: '20000000001',
      docType: '03',
      serie: 'B001',
      correlativo: 1,
      igvTotal: 0,
      total: 10,
      issueDate: '2026-06-02',
      digestValue: 'abc123==',
    });

    expect(qr).toBe('20000000001|03|B001|1|0.00|10.00|2026-06-02|||abc123==');
  });
});
