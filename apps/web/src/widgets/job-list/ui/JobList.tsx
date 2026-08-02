import { StatusBadge, useGetJobsQuery } from '@entities/job';
import { SelectJobButton } from '@features/select-job';
import { JOB_LIST_POLLING_MS } from '@shared/config';
import { formatApiError } from '@shared/api';
import { formatDate } from '@shared/lib/date';
import { Button } from '@shared/ui/button';

import styles from './JobList.module.css';

export function JobList(): React.JSX.Element {
  const {
    data: jobs,
    isLoading,
    error,
    refetch,
  } = useGetJobsQuery(undefined, {
    pollingInterval: JOB_LIST_POLLING_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });

  if (isLoading) return <p className={styles.empty}>Loading jobs…</p>;
  if (error !== undefined && jobs === undefined) {
    return (
      <div>
        <p className={styles.error} role="alert">
          {formatApiError(error)}
        </p>
        <Button type="button" variant="secondary" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (jobs === undefined) return <p className={styles.empty}>Jobs are unavailable.</p>;

  return (
    <>
      {error === undefined ? null : (
        <div className={styles.error} role="alert">
          <span>Latest jobs refresh failed: {formatApiError(error)}</span>{' '}
          <Button type="button" variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}
      {jobs.length === 0 ? (
        <p className={styles.empty}>No jobs yet. Add URLs above to start one.</p>
      ) : (
        <ul className={styles.list}>
          {jobs.slice(0, 20).map((job) => (
            <li key={job.id}>
              <SelectJobButton jobId={job.id} className={styles.itemButton}>
                <span className={styles.topline}>
                  <StatusBadge status={job.status} />
                  <span className={styles.date}>{formatDate(job.createdAt)}</span>
                </span>
                <span className={styles.id} title={job.id}>
                  {job.id}
                </span>
                <span className={styles.stats}>
                  {job.urlCount} URLs · ✓ {job.statistics.success} · ✕ {job.statistics.error}
                </span>
              </SelectJobButton>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
