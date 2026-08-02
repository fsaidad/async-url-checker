import type { JobDetails, JobStatus, UrlCheckStatus } from '@url-checker/contracts';

import { shouldPollJob } from './job-status';

function jobDetails(status: JobStatus, resultStatus: UrlCheckStatus): JobDetails {
  return {
    id: 'job-1',
    createdAt: '2026-08-02T12:00:00.000Z',
    startedAt: '2026-08-02T12:00:00.000Z',
    finishedAt: null,
    status,
    urlCount: 1,
    statistics: { success: 0, error: 0 },
    results: [
      {
        id: 'result-1',
        url: 'https://example.test',
        status: resultStatus,
        statusCode: null,
        error: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
      },
    ],
  };
}

describe('shouldPollJob', () => {
  it('waits for the initial request instead of polling an undefined cache entry', () => {
    expect(shouldPollJob(undefined)).toBe(false);
  });

  it.each(['pending', 'in_progress'] as const)('polls a %s job', (status) => {
    expect(shouldPollJob(jobDetails(status, status))).toBe(true);
  });

  it.each([
    ['completed', 'success'],
    ['failed', 'error'],
  ] as const)('stops polling a %s job', (status, resultStatus) => {
    expect(shouldPollJob(jobDetails(status, resultStatus))).toBe(false);
  });

  it('keeps polling a cancelled job only while an in-flight result is settling', () => {
    expect(shouldPollJob(jobDetails('cancelled', 'in_progress'))).toBe(true);
    expect(shouldPollJob(jobDetails('cancelled', 'cancelled'))).toBe(false);
  });
});
