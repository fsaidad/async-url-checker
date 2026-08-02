import { Inject, Injectable, Logger } from '@nestjs/common';

import { AppConfig } from '../../config/app-config.js';
import { JOBS_REPOSITORY, type JobsRepository } from '../ports/jobs-repository.port.js';
import {
  DELAY_SOURCE,
  RANDOM_SOURCE,
  type DelaySource,
  type RandomSource,
} from '../ports/time.port.js';
import { ProbeError, URL_PROBE, type UrlProbe } from '../ports/url-probe.port.js';

@Injectable()
export class JobsProcessor {
  private readonly logger = new Logger(JobsProcessor.name);
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    @Inject(JOBS_REPOSITORY) private readonly repository: JobsRepository,
    @Inject(URL_PROBE) private readonly probe: UrlProbe,
    @Inject(DELAY_SOURCE) private readonly delay: DelaySource,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  start(jobId: string): void {
    if (this.running.has(jobId)) return;

    const task = this.run(jobId)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unexpected processor failure';
        this.logger.error(`Job ${jobId} failed: ${message}`);
        this.markFailed(jobId);
      })
      .finally(() => this.running.delete(jobId));

    this.running.set(jobId, task);
  }

  waitFor(jobId: string): Promise<void> {
    return this.running.get(jobId) ?? Promise.resolve();
  }

  private async run(jobId: string): Promise<void> {
    const job = this.repository.get(jobId);
    if (job === null) return;

    const workerCount = Math.min(this.config.maxConcurrencyPerJob, job.urlCount);
    let firstFailure: unknown;
    let hasFailed = false;
    const workers = Array.from({ length: workerCount }, () =>
      this.worker(jobId).catch((error: unknown) => {
        if (!hasFailed) {
          hasFailed = true;
          firstFailure = error;
          this.markFailed(jobId);
        }
        throw error;
      }),
    );

    await Promise.allSettled(workers);
    if (hasFailed) throw firstFailure;
  }

  private async worker(jobId: string): Promise<void> {
    while (true) {
      const claimed = this.repository.claimNext(jobId);
      if (claimed === null) return;

      let statusCode: number | null = null;
      let errorMessage: string | null = null;
      try {
        const response = await this.probe.head(claimed.url);
        statusCode = response.statusCode;
        if (response.statusCode >= 400) {
          errorMessage = `HTTP ${response.statusCode}${response.statusText ? ` ${response.statusText}` : ''}`;
        }
      } catch (error: unknown) {
        if (!(error instanceof ProbeError)) throw error;
        errorMessage = error.message;
      }

      const milliseconds = this.random.integer(0, this.config.maxResultDelayMs);
      await this.delay.wait(milliseconds);
      this.repository.completeUrl(jobId, claimed.id, {
        status: errorMessage === null ? 'success' : 'error',
        statusCode,
        error: errorMessage,
      });
    }
  }

  private markFailed(jobId: string): void {
    try {
      this.repository.fail(jobId, 'Processing stopped unexpectedly');
    } catch (repositoryError: unknown) {
      const repositoryMessage =
        repositoryError instanceof Error ? repositoryError.message : 'Unknown repository error';
      this.logger.error(`Could not mark job ${jobId} failed: ${repositoryMessage}`);
    }
  }
}
