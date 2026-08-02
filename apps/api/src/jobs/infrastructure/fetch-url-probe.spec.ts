import { AppConfig } from '../../config/app-config.js';
import { ProbeError } from '../ports/url-probe.port.js';
import { FetchUrlProbe } from './fetch-url-probe.js';

function createProbe(): FetchUrlProbe {
  return new FetchUrlProbe(
    new AppConfig({
      port: 3000,
      webOrigin: 'http://localhost:5173',
      probeTimeoutMs: 123,
      maxUrlsPerJob: 100,
      maxConcurrencyPerJob: 5,
      maxResultDelayMs: 10_000,
    }),
  );
}

function stubFetch(): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FetchUrlProbe', () => {
  it('sends HEAD with the production options and preserves an HTTP response', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' }));

    const response = await createProbe().head('https://example.test/missing');

    expect(response).toEqual({ statusCode: 404, statusText: 'Not Found' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (call === undefined) throw new Error('Expected fetch to be called');
    const [input, init] = call;
    expect(String(input)).toBe('https://example.test/missing');
    expect(init).toMatchObject({
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'user-agent': 'async-url-checker/1.0' },
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each(['TimeoutError', 'AbortError'])('normalizes %s as a timeout', async (name) => {
    const fetchMock = stubFetch();
    fetchMock.mockRejectedValue(new DOMException('aborted', name));

    const error = await createProbe()
      .head('https://example.test')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProbeError);
    expect(error).toMatchObject({ name: 'ProbeError', message: 'Request timed out' });
  });

  it('normalizes network failures without losing their useful message', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND example.test'));

    const error = await createProbe()
      .head('https://example.test')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProbeError);
    expect(error).toMatchObject({
      name: 'ProbeError',
      message: 'getaddrinfo ENOTFOUND example.test',
    });
  });

  it('uses the nested cause from a typical Node fetch failure', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockRejectedValue(
      new TypeError('fetch failed', {
        cause: new Error('connect ECONNREFUSED 127.0.0.1:65534'),
      }),
    );

    const error = await createProbe()
      .head('https://example.test')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProbeError);
    expect(error).toMatchObject({
      name: 'ProbeError',
      message: 'connect ECONNREFUSED 127.0.0.1:65534',
    });
  });

  it('rejects malformed and unsupported URLs before calling fetch', async () => {
    const fetchMock = stubFetch();
    const probe = createProbe();

    await expect(probe.head('not a URL')).rejects.toThrow('Invalid URL');
    await expect(probe.head('ftp://example.test')).rejects.toThrow(
      'Only http and https URLs are supported',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
