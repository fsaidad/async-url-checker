import type { JobStatus, UrlCheckStatus } from '@url-checker/contracts';

export interface JobRecord {
  id: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: JobStatus;
  results: UrlCheckRecord[];
}

export interface UrlCheckRecord {
  id: string;
  url: string;
  status: UrlCheckStatus;
  statusCode: number | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface ClaimedUrl {
  id: string;
  url: string;
}

export interface UrlCheckOutcome {
  status: 'success' | 'error';
  statusCode: number | null;
  error: string | null;
}
