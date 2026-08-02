import type { JobStatus, UrlCheckStatus } from '@url-checker/contracts';

const JOB_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  pending: ['in_progress', 'cancelled', 'failed'],
  in_progress: ['completed', 'cancelled', 'failed'],
  completed: [],
  cancelled: [],
  failed: [],
};

const URL_TRANSITIONS: Readonly<Record<UrlCheckStatus, readonly UrlCheckStatus[]>> = {
  pending: ['in_progress', 'cancelled', 'error'],
  in_progress: ['success', 'error'],
  success: [],
  error: [],
  cancelled: [],
};

export const TERMINAL_JOB_STATUSES: ReadonlySet<JobStatus> = new Set([
  'completed',
  'cancelled',
  'failed',
]);

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

export function canTransitionUrl(from: UrlCheckStatus, to: UrlCheckStatus): boolean {
  return URL_TRANSITIONS[from].includes(to);
}
