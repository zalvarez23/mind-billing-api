import {
  aggregatePreviewTotals,
  paginateArray,
} from './daily-summaries-preview.util';

describe('daily-summaries-preview.util', () => {
  it('paginates items', () => {
    const result = paginateArray([1, 2, 3, 4, 5], 2, 2);

    expect(result.data).toEqual([3, 4]);
    expect(result.meta).toEqual({
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
  });

  it('aggregates line totals', () => {
    const totals = aggregatePreviewTotals([
      {
        lineId: 1,
        docType: '03',
        serie: 'B001',
        correlativo: 1,
        clienteTipoDoc: '1',
        clienteNumDoc: '12345678',
        moneda: 'PEN',
        subtotal: 100,
        igvTotal: 18,
        total: 118,
      },
      {
        lineId: 2,
        docType: '07',
        serie: 'BC01',
        correlativo: 1,
        clienteTipoDoc: '1',
        clienteNumDoc: '12345678',
        moneda: 'PEN',
        subtotal: 50,
        igvTotal: 9,
        total: 59,
      },
    ]);

    expect(totals).toEqual({ subtotal: 150, igvTotal: 27, total: 177 });
  });
});
