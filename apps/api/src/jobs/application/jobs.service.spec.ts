import { BadRequestException } from '@nestjs/common';
import { MAX_URLS_PER_JOB } from '@url-checker/contracts';

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
    const service = new JobsService(repository, processor);

    expect(() => service.create([])).toThrow(BadRequestException);
    expect(() => service.create([])).toThrow('A job must contain at least one URL');
    expect(repository.list()).toEqual([]);
  });

  it('accepts exactly the fixed shared URL limit', async () => {
    const repository = new InMemoryJobsRepository();
    const config = appConfig();
    const processor = new JobsProcessor(
      repository,
      successfulProbe,
      immediateDelay,
      fixedRandom,
      config,
    );
    const service = new JobsService(repository, processor);
    const urls = Array.from(
      { length: MAX_URLS_PER_JOB },
      (_, index) => `https://example-${index}.test`,
    );

    const created = service.create(urls);
    await processor.waitFor(created.jobId);

    expect(repository.get(created.jobId)).toMatchObject({
      status: 'completed',
      urlCount: MAX_URLS_PER_JOB,
    });
  });

  it('rejects more than the fixed shared URL limit', () => {
    const repository = new InMemoryJobsRepository();
    const config = appConfig();
    const processor = new JobsProcessor(
      repository,
      successfulProbe,
      immediateDelay,
      fixedRandom,
      config,
    );
    const service = new JobsService(repository, processor);
    const urls = Array.from(
      { length: MAX_URLS_PER_JOB + 1 },
      (_, index) => `https://example-${index}.test`,
    );

    expect(() => service.create(urls)).toThrow(BadRequestException);
    expect(() => service.create(urls)).toThrow(
      `A job may contain at most ${MAX_URLS_PER_JOB} URLs`,
    );
    expect(repository.list()).toEqual([]);
  });
});
