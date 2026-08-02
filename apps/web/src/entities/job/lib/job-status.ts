import type { JobDetails, JobStatus } from '@url-checker/contracts';

export const TERMINAL_JOB_STATUSES: ReadonlySet<JobStatus> = new Set([
  'completed',
  'cancelled',
  'failed',
]);

export function isTerminalJobStatus(status: JobStatus | undefined): boolean {
  return status !== undefined && TERMINAL_JOB_STATUSES.has(status);
}

export function shouldPollJob(details: JobDetails | undefined): boolean {
  if (details === undefined) return false;
  if (!isTerminalJobStatus(details.status)) return true;

  // Cancellation stops new work immediately, but checks which were already in flight
  // are allowed to settle. Keep refreshing until their final result is visible.
  return (
    details.status === 'cancelled' &&
    details.results.some((result) => result.status === 'pending' || result.status === 'in_progress')
  );
}

export function statusLabel(status: JobStatus): string {
  const labels: Record<JobStatus, string> = {
    pending: 'Pending',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    failed: 'Failed',
  };
  return labels[status];
}
