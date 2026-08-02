import { parseUrls } from './parse-urls';

describe('parseUrls', () => {
  it('trims lines, removes blanks and duplicates, and keeps valid URLs', () => {
    expect(
      parseUrls('  https://example.com  \n\nhttps://example.com\nhttp://second.test/path'),
    ).toEqual({
      urls: ['https://example.com', 'http://second.test/path'],
      duplicateCount: 1,
      errors: [],
    });
  });

  it('reports line-specific protocol and syntax errors', () => {
    const result = parseUrls('ftp://example.com\nnot a url');
    expect(result.urls).toEqual([]);
    expect(result.errors).toEqual([
      'Line 1: only http:// and https:// URLs are supported.',
      'Line 2: “not a url” is not a valid URL.',
    ]);
  });

  it('preserves physical line numbers when blank lines are skipped', () => {
    expect(parseUrls('\n  \nnot a url').errors).toEqual([
      'Line 3: “not a url” is not a valid URL.',
    ]);
  });

  it('accepts 100 unique URLs and rejects 101', () => {
    const oneHundred = Array.from({ length: 100 }, (_, index) => `https://example.com/${index}`);

    expect(parseUrls(oneHundred.join('\n')).errors).toEqual([]);
    expect(parseUrls([...oneHundred, 'https://example.com/100'].join('\n')).errors).toEqual([
      'A job may contain at most 100 unique URLs.',
    ]);
  });

  it('rejects empty input', () => {
    expect(parseUrls(' \n ')).toMatchObject({
      urls: [],
      errors: ['Enter at least one URL.'],
    });
  });
});
