export const JOB_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled', 'failed'] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const URL_CHECK_STATUSES = [
  'pending',
  'in_progress',
  'success',
  'error',
  'cancelled',
] as const;

export type UrlCheckStatus = (typeof URL_CHECK_STATUSES)[number];

/** Fixed per-job limit shared by API validation, OpenAPI, and the web client. */
export const MAX_URLS_PER_JOB = 100;

export interface JobStatistics {
  success: number;
  error: number;
}

export interface JobListItem {
  id: string;
  createdAt: string;
  status: JobStatus;
  urlCount: number;
  statistics: JobStatistics;
}

export interface UrlCheckResult {
  id: string;
  url: string;
  status: UrlCheckStatus;
  statusCode: number | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface JobDetails extends JobListItem {
  startedAt: string | null;
  finishedAt: string | null;
  results: UrlCheckResult[];
}

export interface CreateJobRequest {
  urls: string[];
}

export interface CreateJobResponse {
  jobId: string;
}

export type CancelJobResponse = JobDetails;
