import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { AppConfig } from '../src/config/app-config.js';
import { JobsProcessor } from '../src/jobs/application/jobs-processor.js';
import {
  DELAY_SOURCE,
  RANDOM_SOURCE,
  type DelaySource,
  type RandomSource,
} from '../src/jobs/ports/time.port.js';
import { URL_PROBE, type ProbeResponse, type UrlProbe } from '../src/jobs/ports/url-probe.port.js';

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: () => resolvePromise?.() };
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

class TestProbe implements UrlProbe {
  calls = 0;
  blocked = false;
  private gate = deferred();

  async head(url: string): Promise<ProbeResponse> {
    this.calls += 1;
    if (this.blocked) await this.gate.promise;
    if (url.includes('missing')) return { statusCode: 404, statusText: 'Not Found' };
    return { statusCode: 200, statusText: 'OK' };
  }

  block(): void {
    this.blocked = true;
    this.gate = deferred();
  }

  release(): void {
    this.gate.resolve();
    this.blocked = false;
  }
}

const immediateDelay: DelaySource = { wait: async () => undefined };
const fixedRandom: RandomSource = { integer: () => 0 };

describe('Jobs API (e2e)', () => {
  let app: INestApplication;
  let probe: TestProbe;
  let processor: JobsProcessor;

  beforeEach(async () => {
    probe = new TestProbe();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AppConfig)
      .useValue(
        new AppConfig({
          port: 3000,
          webOrigin: 'http://localhost:5173',
          probeTimeoutMs: 100,
          maxUrlsPerJob: 100,
          maxConcurrencyPerJob: 5,
          maxResultDelayMs: 0,
        }),
      )
      .overrideProvider(URL_PROBE)
      .useValue(probe)
      .overrideProvider(DELAY_SOURCE)
      .useValue(immediateDelay)
      .overrideProvider(RANDOM_SOURCE)
      .useValue(fixedRandom)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    processor = app.get(JobsProcessor);
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates, lists, reads, and completes a job', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/jobs')
      .send({ urls: ['https://example.test', 'https://example.test/missing'] })
      .expect(202);
    const jobId = String(created.body.jobId);
    await processor.waitFor(jobId);

    const list = await request(app.getHttpServer()).get('/api/jobs').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      id: jobId,
      status: 'completed',
      urlCount: 2,
      statistics: { success: 1, error: 1 },
    });

    const details = await request(app.getHttpServer()).get(`/api/jobs/${jobId}`).expect(200);
    expect(details.body.results).toHaveLength(2);
    expect(details.body.results[1]).toMatchObject({ status: 'error', statusCode: 404 });
    expect(details.body.results[0].startedAt).toMatch(/Z$/);
    expect(details.body.results[0].finishedAt).toMatch(/Z$/);
    expect(details.body.results[0].durationMs).toEqual(expect.any(Number));
  });

  it('cancels without starting pending URLs', async () => {
    probe.block();
    const urls = Array.from({ length: 8 }, (_, index) => `https://cancel-${index}.test`);
    const created = await request(app.getHttpServer()).post('/api/jobs').send({ urls }).expect(202);
    const jobId = String(created.body.jobId);
    await eventually(() => expect(probe.calls).toBe(5));

    const cancelled = await request(app.getHttpServer()).delete(`/api/jobs/${jobId}`).expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(
      cancelled.body.results.filter((item: { status: string }) => item.status === 'cancelled'),
    ).toHaveLength(3);

    probe.release();
    await processor.waitFor(jobId);
    const details = await request(app.getHttpServer()).get(`/api/jobs/${jobId}`).expect(200);
    expect(probe.calls).toBe(5);
    expect(details.body.status).toBe('cancelled');
  });

  it.each([
    [{ urls: [] }],
    [{ urls: ['ftp://example.test'] }],
    [{ urls: ['not a URL'] }],
    [{ urls: ['https://example.test'], extra: true }],
  ])('rejects invalid input %#', async (body) => {
    await request(app.getHttpServer()).post('/api/jobs').send(body).expect(400);
  });

  it('returns 404 for unknown jobs and exposes health', async () => {
    await request(app.getHttpServer()).get('/api/jobs/unknown').expect(404);
    await request(app.getHttpServer()).delete('/api/jobs/unknown').expect(404);
    await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
  });
});
