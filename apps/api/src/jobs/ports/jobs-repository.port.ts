import type { JobListItem, JobDetails } from '@url-checker/contracts';

import type { ClaimedUrl, UrlCheckOutcome } from '../domain/job.js';

export const JOBS_REPOSITORY = Symbol('JOBS_REPOSITORY');

export interface JobsRepository {
  create(urls: readonly string[]): JobDetails;
  list(): JobListItem[];
  get(id: string): JobDetails | null;
  claimNext(id: string): ClaimedUrl | null;
  completeUrl(jobId: string, urlId: string, outcome: UrlCheckOutcome): void;
  cancel(id: string): JobDetails | null;
  fail(id: string, reason: string): void;
}
