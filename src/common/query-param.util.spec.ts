import { toQueryStringArray } from './query-param.util';

describe('toQueryStringArray', () => {
  it('returns undefined for empty values', () => {
    expect(toQueryStringArray(undefined)).toBeUndefined();
    expect(toQueryStringArray(null)).toBeUndefined();
    expect(toQueryStringArray('')).toBeUndefined();
  });

  it('parses a single value', () => {
    expect(toQueryStringArray('03')).toEqual(['03']);
  });

  it('parses comma-separated values', () => {
    expect(toQueryStringArray('03,07,08')).toEqual(['03', '07', '08']);
  });

  it('trims spaces around comma-separated values', () => {
    expect(toQueryStringArray('03, 07 , 08')).toEqual(['03', '07', '08']);
  });

  it('flattens repeated query params', () => {
    expect(toQueryStringArray(['03', '07'])).toEqual(['03', '07']);
  });
});
