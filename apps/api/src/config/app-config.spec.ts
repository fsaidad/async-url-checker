import { ConfigService } from '@nestjs/config';

import { createAppConfig } from './app-config.js';

function configWithMaxUrls(value?: string): ConfigService {
  const values: Record<string, string> = {};
  if (value !== undefined) values['MAX_URLS_PER_JOB'] = value;
  return new ConfigService(values);
}

describe('createAppConfig', () => {
  it('uses 100 as the default and accepts the configured boundaries', () => {
    expect(createAppConfig(configWithMaxUrls()).maxUrlsPerJob).toBe(100);
    expect(createAppConfig(configWithMaxUrls('1')).maxUrlsPerJob).toBe(1);
    expect(createAppConfig(configWithMaxUrls('100')).maxUrlsPerJob).toBe(100);
  });

  it.each(['0', '101', '-1', '1.5'])('rejects MAX_URLS_PER_JOB=%s', (value) => {
    expect(() => createAppConfig(configWithMaxUrls(value))).toThrow(
      'MAX_URLS_PER_JOB must be an integer between 1 and 100',
    );
  });
});
