import { skipToken } from '@reduxjs/toolkit/query';
import { useSelector } from 'react-redux';
import type { UrlCheckStatus } from '@url-checker/contracts';

import {
  jobApi,
  selectActiveJobId,
  shouldPollJob,
  StatusBadge,
  useGetJobQuery,
} from '@entities/job';
import { CancelJobButton } from '@features/cancel-job';
import { formatApiError, isTransientApiError } from '@shared/api';
import { ACTIVE_JOB_POLLING_MS, ACTIVE_JOB_RECOVERY_POLLING_MS } from '@shared/config';
import { Button } from '@shared/ui/button';

import styles from './JobDetails.module.css';

const resultLabels: Record<UrlCheckStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  success: 'Success',
  error: 'Error',
  cancelled: 'Cancelled',
};

const resultIcons: Record<UrlCheckStatus, string> = {
  pending: '○',
  in_progress: '↻',
  success: '✓',
  error: '✕',
  cancelled: '⊘',
};

export function JobDetails(): React.JSX.Element {
  const activeJobId = useSelector(selectActiveJobId);
  const cachedQuery = useSelector(jobApi.endpoints.getJob.select(activeJobId ?? ''));
  const cachedJobIsPollable = cachedQuery.data === undefined || shouldPollJob(cachedQuery.data);
  const recovering = isTransientApiError(cachedQuery.error) && cachedJobIsPollable;
  const pollingInterval =
    cachedQuery.error === undefined
      ? shouldPollJob(cachedQuery.data)
        ? ACTIVE_JOB_POLLING_MS
        : 0
      : recovering
        ? ACTIVE_JOB_RECOVERY_POLLING_MS
        : 0;
  const query = useGetJobQuery(activeJobId ?? skipToken, {
    // Network and 5xx failures retry at a reduced cadence. Permanent responses such as
    // 404 stop automatic work until the user explicitly retries.
    pollingInterval,
    skipPollingIfUnfocused: true,
    refetchOnFocus: cachedQuery.error === undefined || recovering,
  });
  const details = query.currentData;

  if (activeJobId === null) {
    return <p className={styles.empty}>Select a recent job or create a new one.</p>;
  }
  if (query.isLoading || (query.isFetching && details === undefined)) {
    return <p className={styles.empty}>Loading job details…</p>;
  }
  if (query.error !== undefined && details === undefined) {
    return (
      <div>
        <p className={styles.error} role="alert">
          {formatApiError(query.error)}
        </p>
        <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
          Retry
        </Button>
        {isTransientApiError(query.error) ? (
          <p className={styles.muted}>Automatic recovery will retry shortly.</p>
        ) : null}
      </div>
    );
  }
  if (details === undefined) return <p className={styles.empty}>Job details are unavailable.</p>;

  const completedCount = details.results.filter((result) =>
    ['success', 'error', 'cancelled'].includes(result.status),
  ).length;
  const pollable = shouldPollJob(details);
  const recoveringFromError = query.error !== undefined && isTransientApiError(query.error);
  const pollingPaused = query.error !== undefined && !recoveringFromError && pollable;

  return (
    <div data-testid="job-details" data-job-id={details.id}>
      {query.error === undefined ? null : (
        <div className={styles.error} role="alert">
          <span>Latest update failed: {formatApiError(query.error)}</span>{' '}
          <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      )}
      <div className={styles.header}>
        <div className={styles.headingMeta}>
          <span>
            <StatusBadge status={details.status} />
            {query.isFetching && !query.isLoading ? (
              <span className={styles.refreshing}>Refreshing…</span>
            ) : null}
          </span>
          <span className={styles.jobId}>{details.id}</span>
        </div>
        <CancelJobButton key={details.id} jobId={details.id} status={details.status} />
      </div>

      <div className={styles.progressLabel}>
        <span>Progress</span>
        <span>
          {completedCount}/{details.urlCount}
        </span>
      </div>
      <progress
        className={styles.progress}
        max={details.urlCount}
        value={completedCount}
        aria-label={`Job progress: ${completedCount} of ${details.urlCount}`}
        aria-valuemin={0}
        aria-valuemax={details.urlCount}
        aria-valuenow={completedCount}
      />

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">URL</th>
              <th scope="col">Result</th>
              <th scope="col">HTTP</th>
              <th scope="col">Duration</th>
              <th scope="col">Error</th>
            </tr>
          </thead>
          <tbody>
            {details.results.map((result) => (
              <tr key={result.id}>
                <td>
                  <a className={styles.url} href={result.url} target="_blank" rel="noreferrer">
                    {result.url}
                  </a>
                </td>
                <td>
                  <span
                    className={`${styles.resultStatus} ${
                      result.status === 'error' ? styles.errorStatus : styles[result.status]
                    }`}
                    data-icon={resultIcons[result.status]}
                  >
                    {resultLabels[result.status]}
                  </span>
                </td>
                <td>{result.statusCode ?? '—'}</td>
                <td>{result.durationMs === null ? '—' : `${result.durationMs} ms`}</td>
                <td className={styles.errorText}>{result.error ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className={styles.muted}>
        {recoveringFromError && pollable
          ? 'Retrying automatically at a reduced rate.'
          : pollingPaused
            ? 'Automatic updates paused. Retry to continue.'
            : pollable
              ? details.status === 'cancelled'
                ? 'Waiting for in-flight checks to finish.'
                : 'Updates automatically while this job is running.'
              : 'This job is terminal.'}
      </span>
    </div>
  );
}
