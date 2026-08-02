import { BadRequestException } from '@nestjs/common';

import { AppConfig } from '../../config/app-config.js';
import { InMemoryJobsRepository } from '../infrastructure/in-memory-jobs.repository.js';
import type { DelaySource, RandomSource } from '../ports/time.port.js';
import type { ProbeResponse, UrlProbe } from '../ports/url-probe.port.js';
import { JobsProcessor } from './jobs-processor.js';
import { JobsService } from './jobs.service.js';

const immediateDelay: DelaySource = { wait: async () => undefined };
const fixedRandom: RandomSource = { integer: () => 0 };
const successfulProbe: UrlProbe = {
  async head(): Promise<ProbeResponse> {
    return { statusCode: 200, statusText: 'OK' };
  },
};

function appConfig(): AppConfig {
  return new AppConfig({
    port: 3000,
    webOrigin: 'http://localhost:5173',
    probeTimeoutMs: 100,
    maxUrlsPerJob: 100,
    maxConcurrencyPerJob: 5,
    maxResultDelayMs: 0,
  });
}

describe('JobsService', () => {
  it('rejects an empty URL list as an application invariant', () => {
    const repository = new InMemoryJobsRepository();
    const config = appConfig();
    const processor = new JobsProcessor(
      repository,
      successfulProbe,
      immediateDelay,
      fixedRandom,
      config,
    );
    const service = new JobsService(repository, processor, config);

    expect(() => service.create([])).toThrow(BadRequestException);
    expect(() => service.create([])).toThrow('A job must contain at least one URL');
    expect(repository.list()).toEqual([]);
  });
});
