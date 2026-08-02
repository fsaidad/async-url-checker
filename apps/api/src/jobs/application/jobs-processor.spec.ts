import { Logger } from '@nestjs/common';

import { AppConfig, type AppConfigValues } from '../../config/app-config.js';
import { InMemoryJobsRepository } from '../infrastructure/in-memory-jobs.repository.js';
import type { DelaySource, RandomSource } from '../ports/time.port.js';
import { ProbeError, type ProbeResponse, type UrlProbe } from '../ports/url-probe.port.js';
import { JobsProcessor } from './jobs-processor.js';

function appConfig(overrides: Partial<AppConfigValues> = {}): AppConfig {
  return new AppConfig({
    port: 3000,
    webOrigin: 'http://localhost:5173',
    probeTimeoutMs: 100,
    maxUrlsPerJob: 100,
    maxConcurrencyPerJob: 5,
    maxResultDelayMs: 10_000,
    ...overrides,
  });
}

class ImmediateDelay implements DelaySource {
  readonly values: number[] = [];

  async wait(milliseconds: number): Promise<void> {
    this.values.push(milliseconds);
  }
}

class FailingThenGatedDelay implements DelaySource {
  calls = 0;
  private readonly gate = deferred<void>();

  async wait(): Promise<void> {
    this.calls += 1;
    if (this.calls === 1) throw new Error('Delay adapter failed');
    await this.gate.promise;
  }

  release(): void {
    this.gate.resolve(undefined);
  }
}

class FixedRandom implements RandomSource {
  constructor(private readonly value = 0) {}

  integer(minimum: number, maximum: number): number {
    expect(this.value).toBeGreaterThanOrEqual(minimum);
    expect(this.value).toBeLessThanOrEqual(maximum);
    return this.value;
  }
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((reason: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve: (value: T) => resolvePromise?.(value),
    reject: (reason: unknown) => rejectPromise?.(reason),
  };
}

async function eventually(assertion: () => void): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      assertion();
      return;
    } catch {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }
  assertion();
}

class GatedProbe implements UrlProbe {
  readonly started: string[] = [];
  active = 0;
  maxActive = 0;
  private readonly gate = deferred<void>();

  async head(url: string): Promise<ProbeResponse> {
    this.started.push(url);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    await this.gate.promise;
    this.active -= 1;
    return { statusCode: 204, statusText: 'No Content' };
  }

  release(): void {
    this.gate.resolve(undefined);
  }
}

describe('JobsProcessor', () => {
  it('never runs more than five probes inside one job', async () => {
    const repository = new InMemoryJobsRepository();
    const probe = new GatedProbe();
    const processor = new JobsProcessor(
      repository,
      probe,
      new ImmediateDelay(),
      new FixedRandom(),
      appConfig(),
    );
    const job = repository.create(
      Array.from({ length: 12 }, (_, index) => `https://url-${index}.test`),
    );

    processor.start(job.id);
    await eventually(() => expect(probe.started).toHaveLength(5));
    expect(probe.maxActive).toBe(5);

    probe.release();
    await processor.waitFor(job.id);

    expect(probe.maxActive).toBe(5);
    expect(repository.get(job.id)?.status).toBe('completed');
  });

  it('runs independent pools for two jobs concurrently', async () => {
    const repository = new InMemoryJobsRepository();
    const probe = new GatedProbe();
    const processor = new JobsProcessor(
      repository,
      probe,
      new ImmediateDelay(),
      new FixedRandom(),
      appConfig(),
    );
    const first = repository.create(
      Array.from({ length: 6 }, (_, index) => `https://first-${index}.test`),
    );
    const second = repository.create(
      Array.from({ length: 6 }, (_, index) => `https://second-${index}.test`),
    );

    processor.start(first.id);
    processor.start(second.id);
    await eventually(() => expect(probe.started).toHaveLength(10));

    expect(probe.active).toBe(10);
    probe.release();
    await Promise.all([processor.waitFor(first.id), processor.waitFor(second.id)]);
    expect(repository.get(first.id)?.status).toBe('completed');
    expect(repository.get(second.id)?.status).toBe('completed');
  });

  it('cancels pending URLs, lets in-progress URLs finish, and preserves cancelled', async () => {
    const repository = new InMemoryJobsRepository();
    const probe = new GatedProbe();
    const processor = new JobsProcessor(
      repository,
      probe,
      new ImmediateDelay(),
      new FixedRandom(),
      appConfig(),
    );
    const job = repository.create(
      Array.from({ length: 8 }, (_, index) => `https://cancel-${index}.test`),
    );

    processor.start(job.id);
    await eventually(() => expect(probe.started).toHaveLength(5));
    expect(repository.cancel(job.id)?.status).toBe('cancelled');
    probe.release();
    await processor.waitFor(job.id);

    const completed = repository.get(job.id);
    expect(probe.started).toHaveLength(5);
    expect(completed?.status).toBe('cancelled');
    expect(completed?.results.filter((item) => item.status === 'success')).toHaveLength(5);
    expect(completed?.results.filter((item) => item.status === 'cancelled')).toHaveLength(3);
  });

  it('settles every in-progress URL as error when a worker fails after cancellation', async () => {
    const repository = new InMemoryJobsRepository();
    const failingResponse = deferred<ProbeResponse>();
    const otherResponse = deferred<ProbeResponse>();
    const logger = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const probe: UrlProbe = {
      async head(url: string): Promise<ProbeResponse> {
        return url.endsWith('/failing') ? failingResponse.promise : otherResponse.promise;
      },
    };
    const processor = new JobsProcessor(
      repository,
      probe,
      new ImmediateDelay(),
      new FixedRandom(),
      appConfig({ maxConcurrencyPerJob: 2 }),
    );
    const job = repository.create([
      'https://cancelled-failure.test/failing',
      'https://cancelled-failure.test/other',
    ]);

    processor.start(job.id);
    await eventually(() =>
      expect(
        repository.get(job.id)?.results.every((result) => result.status === 'in_progress'),
      ).toBe(true),
    );
    expect(repository.cancel(job.id)?.status).toBe('cancelled');
    failingResponse.reject(new Error('Probe adapter failed after cancellation'));
    await eventually(() =>
      expect(repository.get(job.id)?.results.every((result) => result.status === 'error')).toBe(
        true,
      ),
    );
    otherResponse.resolve({ statusCode: 200, statusText: 'OK' });
    await processor.waitFor(job.id);

    expect(repository.get(job.id)).toMatchObject({
      status: 'cancelled',
      statistics: { success: 0, error: 2 },
      results: [
        expect.objectContaining({
          status: 'error',
          error: 'Processing stopped unexpectedly',
          finishedAt: expect.any(String),
          durationMs: expect.any(Number),
        }),
        expect.objectContaining({
          status: 'error',
          error: 'Processing stopped unexpectedly',
          finishedAt: expect.any(String),
          durationMs: expect.any(Number),
        }),
      ],
    });
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('Probe adapter failed after cancellation'),
    );
  });

  it('fails every unfinished result and remains tracked until all workers settle', async () => {
    const repository = new InMemoryJobsRepository();
    const delay = new FailingThenGatedDelay();
    const logger = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const probe: UrlProbe = {
      async head(): Promise<ProbeResponse> {
        return { statusCode: 200, statusText: 'OK' };
      },
    };
    const processor = new JobsProcessor(repository, probe, delay, new FixedRandom(), appConfig());
    const job = repository.create(
      Array.from({ length: 8 }, (_, index) => `https://failure-${index}.test`),
    );

    processor.start(job.id);
    let processorSettled = false;
    const completion = processor.waitFor(job.id).then(() => {
      processorSettled = true;
    });

    await eventually(() => expect(repository.get(job.id)?.status).toBe('failed'));
    await new Promise<void>((resolve) => setImmediate(resolve));

    const failed = repository.get(job.id);
    expect(processorSettled).toBe(false);
    expect(failed?.statistics).toEqual({ success: 0, error: 8 });
    expect(failed?.results.every((result) => result.status === 'error')).toBe(true);
    expect(failed?.results.every((result) => result.finishedAt !== null)).toBe(true);
    expect(
      failed?.results
        .filter((result) => result.startedAt !== null)
        .every((result) => typeof result.durationMs === 'number'),
    ).toBe(true);

    delay.release();
    await completion;

    expect(processorSettled).toBe(true);
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('Delay adapter failed'));
  });

  it('records HTTP failures, transport errors, statistics, and injected delay', async () => {
    const repository = new InMemoryJobsRepository();
    const delay = new ImmediateDelay();
    const probe: UrlProbe = {
      async head(url: string): Promise<ProbeResponse> {
        if (url.endsWith('/missing')) return { statusCode: 404, statusText: 'Not Found' };
        if (url.endsWith('/timeout')) throw new ProbeError('Request timed out');
        return { statusCode: 301, statusText: 'Moved Permanently' };
      },
    };
    const processor = new JobsProcessor(
      repository,
      probe,
      delay,
      new FixedRandom(1234),
      appConfig(),
    );
    const job = repository.create([
      'https://example.test/ok',
      'https://example.test/missing',
      'https://example.test/timeout',
    ]);

    processor.start(job.id);
    await processor.waitFor(job.id);

    const completed = repository.get(job.id);
    expect(completed?.status).toBe('completed');
    expect(completed?.statistics).toEqual({ success: 1, error: 2 });
    expect(completed?.results[1]).toMatchObject({
      status: 'error',
      statusCode: 404,
      error: 'HTTP 404 Not Found',
    });
    expect(completed?.results[2]).toMatchObject({
      status: 'error',
      statusCode: null,
      error: 'Request timed out',
    });
    expect(delay.values).toEqual([1234, 1234, 1234]);
  });

  it('treats an unexpected probe error as a processor failure', async () => {
    const repository = new InMemoryJobsRepository();
    const logger = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const probe: UrlProbe = {
      async head(): Promise<ProbeResponse> {
        throw new Error('Probe adapter defect');
      },
    };
    const processor = new JobsProcessor(
      repository,
      probe,
      new ImmediateDelay(),
      new FixedRandom(),
      appConfig(),
    );
    const job = repository.create(['https://example.test']);

    processor.start(job.id);
    await processor.waitFor(job.id);

    expect(repository.get(job.id)).toMatchObject({
      status: 'failed',
      statistics: { success: 0, error: 1 },
      results: [
        expect.objectContaining({
          status: 'error',
          error: 'Processing stopped unexpectedly',
          finishedAt: expect.any(String),
          durationMs: expect.any(Number),
        }),
      ],
    });
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('Probe adapter defect'));
  });

  it('keeps terminal states terminal', () => {
    const repository = new InMemoryJobsRepository();
    const job = repository.create(['https://example.test']);
    const claimed = repository.claimNext(job.id);
    expect(claimed).not.toBeNull();
    repository.cancel(job.id);
    repository.fail(job.id, 'should be ignored');
    if (claimed !== null) {
      repository.completeUrl(job.id, claimed.id, {
        status: 'success',
        statusCode: 200,
        error: null,
      });
    }
    expect(repository.get(job.id)?.status).toBe('cancelled');
  });

  it('uses failed only for an unexpected processor-level failure', () => {
    const repository = new InMemoryJobsRepository();
    const job = repository.create(['https://one.test', 'https://two.test']);
    const claimed = repository.claimNext(job.id);
    expect(claimed).not.toBeNull();

    repository.fail(job.id, 'Processing stopped unexpectedly');

    const failed = repository.get(job.id);
    expect(failed?.status).toBe('failed');
    expect(failed?.results).toEqual([
      expect.objectContaining({
        status: 'error',
        error: 'Processing stopped unexpectedly',
        startedAt: expect.any(String),
        finishedAt: expect.any(String),
        durationMs: expect.any(Number),
      }),
      expect.objectContaining({ status: 'error', error: 'Processing stopped unexpectedly' }),
    ]);
    repository.cancel(job.id);
    expect(repository.get(job.id)?.status).toBe('failed');
  });
});
