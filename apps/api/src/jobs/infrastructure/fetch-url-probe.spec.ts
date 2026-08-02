import { AppConfig } from '../../config/app-config.js';
import { ProbeError } from '../ports/url-probe.port.js';
import { FetchUrlProbe } from './fetch-url-probe.js';

function createProbe(): FetchUrlProbe {
  return new FetchUrlProbe(
    new AppConfig({
      port: 3000,
      webOrigin: 'http://localhost:5173',
      probeTimeoutMs: 123,
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

function errorWithCode(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
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

  it.each([
    ['ENOTFOUND', 'DNS lookup failed'],
    ['EAI_AGAIN', 'DNS lookup failed'],
    ['ECONNREFUSED', 'Connection refused'],
    ['ECONNRESET', 'Connection reset'],
    ['ETIMEDOUT', 'Request timed out'],
    ['UND_ERR_CONNECT_TIMEOUT', 'Request timed out'],
    ['CERT_HAS_EXPIRED', 'TLS connection failed'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'TLS connection failed'],
  ])('normalizes nested cause code %s as a stable message', async (code, message) => {
    const fetchMock = stubFetch();
    fetchMock.mockRejectedValue(
      new TypeError('fetch failed with sensitive context', {
        cause: errorWithCode(code, 'sensitive host and port details'),
      }),
    );

    const error = await createProbe()
      .head('https://example.test')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProbeError);
    expect(error).toMatchObject({ name: 'ProbeError', message });
    expect(error).not.toHaveProperty('message', expect.stringContaining('sensitive'));
  });

  it('uses a safe fallback for unknown errors without exposing raw messages', async () => {
    const fetchMock = stubFetch();
    fetchMock.mockRejectedValue(
      new TypeError('fetch failed for internal-service.test', {
        cause: errorWithCode('UNKNOWN_NETWORK_CODE', 'connect 10.0.0.7:8443'),
      }),
    );

    await expect(createProbe().head('https://example.test')).rejects.toMatchObject({
      name: 'ProbeError',
      message: 'Network request failed',
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
