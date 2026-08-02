import { ConfigService } from '@nestjs/config';

import { createAppConfig } from './app-config.js';

function configWith(values: Record<string, string> = {}): ConfigService {
  return new ConfigService(values);
}

describe('createAppConfig', () => {
  it('uses safe defaults', () => {
    expect(createAppConfig(configWith())).toMatchObject({
      port: 3000,
      probeTimeoutMs: 5_000,
    });
  });

  it.each(['1', '65535'])('accepts PORT=%s', (value) => {
    expect(createAppConfig(configWith({ PORT: value })).port).toBe(Number(value));
  });

  it.each(['0', '65536', '-1', '1.5'])('rejects PORT=%s', (value) => {
    expect(() => createAppConfig(configWith({ PORT: value }))).toThrow(
      'PORT must be an integer between 1 and 65535',
    );
  });

  it.each(['1', '2147483647'])('accepts PROBE_TIMEOUT_MS=%s', (value) => {
    expect(createAppConfig(configWith({ PROBE_TIMEOUT_MS: value })).probeTimeoutMs).toBe(
      Number(value),
    );
  });

  it.each(['0', '2147483648', '-1', '1.5'])('rejects PROBE_TIMEOUT_MS=%s', (value) => {
    expect(() => createAppConfig(configWith({ PROBE_TIMEOUT_MS: value }))).toThrow(
      'PROBE_TIMEOUT_MS must be an integer between 1 and 2147483647',
    );
  });
});
