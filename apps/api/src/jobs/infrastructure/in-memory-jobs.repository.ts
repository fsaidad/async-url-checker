import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { JobDetails, JobListItem, JobStatistics } from '@url-checker/contracts';

import type { ClaimedUrl, JobRecord, UrlCheckOutcome } from '../domain/job.js';
import { canTransitionJob, canTransitionUrl, TERMINAL_JOB_STATUSES } from '../domain/job-state.js';
import type { JobsRepository } from '../ports/jobs-repository.port.js';

@Injectable()
export class InMemoryJobsRepository implements JobsRepository {
  private readonly jobs = new Map<string, JobRecord>();

  create(urls: readonly string[]): JobDetails {
    const createdAt = new Date().toISOString();
    const job: JobRecord = {
      id: randomUUID(),
      createdAt,
      startedAt: null,
      finishedAt: null,
      status: 'pending',
      results: urls.map((url) => ({
        id: randomUUID(),
        url,
        status: 'pending',
        statusCode: null,
        error: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
      })),
    };

    this.jobs.set(job.id, job);
    return this.toDetails(job);
  }

  list(): JobListItem[] {
    // Map iteration is oldest-first; reverse also resolves equal timestamps newest-first.
    return [...this.jobs.values()]
      .reverse()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((job) => this.toListItem(job));
  }

  get(id: string): JobDetails | null {
    const job = this.jobs.get(id);
    return job === undefined ? null : this.toDetails(job);
  }

  claimNext(id: string): ClaimedUrl | null {
    const job = this.jobs.get(id);
    if (job === undefined || TERMINAL_JOB_STATUSES.has(job.status)) {
      return null;
    }

    const next = job.results.find((result) => result.status === 'pending');
    if (next === undefined) {
      return null;
    }

    const now = new Date().toISOString();
    if (job.status === 'pending' && canTransitionJob(job.status, 'in_progress')) {
      job.status = 'in_progress';
      job.startedAt = now;
    }
    if (!canTransitionUrl(next.status, 'in_progress')) {
      return null;
    }
    next.status = 'in_progress';
    next.startedAt = now;
    return { id: next.id, url: next.url };
  }

  completeUrl(jobId: string, urlId: string, outcome: UrlCheckOutcome): void {
    const job = this.jobs.get(jobId);
    if (job === undefined || job.status === 'failed' || job.status === 'completed') {
      return;
    }

    const result = job.results.find((candidate) => candidate.id === urlId);
    if (result === undefined || !canTransitionUrl(result.status, outcome.status)) {
      return;
    }

    const finishedAt = new Date().toISOString();
    result.status = outcome.status;
    result.statusCode = outcome.statusCode;
    result.error = outcome.error;
    result.finishedAt = finishedAt;
    result.durationMs =
      result.startedAt === null
        ? null
        : Math.max(0, Date.parse(finishedAt) - Date.parse(result.startedAt));

    const allSettled = job.results.every((item) =>
      ['success', 'error', 'cancelled'].includes(item.status),
    );
    if (allSettled && job.status === 'in_progress' && canTransitionJob(job.status, 'completed')) {
      job.status = 'completed';
      job.finishedAt = finishedAt;
    }
  }

  cancel(id: string): JobDetails | null {
    const job = this.jobs.get(id);
    if (job === undefined) {
      return null;
    }
    if (TERMINAL_JOB_STATUSES.has(job.status)) {
      return this.toDetails(job);
    }

    if (!canTransitionJob(job.status, 'cancelled')) {
      return this.toDetails(job);
    }

    const finishedAt = new Date().toISOString();
    job.status = 'cancelled';
    job.finishedAt = finishedAt;
    for (const result of job.results) {
      if (result.status === 'pending' && canTransitionUrl(result.status, 'cancelled')) {
        result.status = 'cancelled';
        result.finishedAt = finishedAt;
      }
    }
    return this.toDetails(job);
  }

  fail(id: string, reason: string): void {
    const job = this.jobs.get(id);
    // A cancelled parent stays terminal, but its in-flight results still need to settle.
    if (job === undefined || job.status === 'completed' || job.status === 'failed') {
      return;
    }

    const finishedAt = new Date().toISOString();
    if (job.status !== 'cancelled') {
      if (!canTransitionJob(job.status, 'failed')) {
        return;
      }
      job.status = 'failed';
      job.finishedAt = finishedAt;
    }
    for (const result of job.results) {
      if (
        (result.status === 'pending' || result.status === 'in_progress') &&
        canTransitionUrl(result.status, 'error')
      ) {
        result.status = 'error';
        result.statusCode = null;
        result.error = reason;
        result.finishedAt = finishedAt;
        result.durationMs =
          result.startedAt === null
            ? null
            : Math.max(0, Date.parse(finishedAt) - Date.parse(result.startedAt));
      }
    }
  }

  private statistics(job: JobRecord): JobStatistics {
    return job.results.reduce<JobStatistics>(
      (statistics, result) => {
        if (result.status === 'success') statistics.success += 1;
        if (result.status === 'error') statistics.error += 1;
        return statistics;
      },
      { success: 0, error: 0 },
    );
  }

  private toListItem(job: JobRecord): JobListItem {
    return {
      id: job.id,
      createdAt: job.createdAt,
      status: job.status,
      urlCount: job.results.length,
      statistics: this.statistics(job),
    };
  }

  private toDetails(job: JobRecord): JobDetails {
    return {
      ...this.toListItem(job),
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      results: job.results.map((result) => ({ ...result })),
    };
  }
}
