import { useSelector } from 'react-redux';
import type { JobDetails as JobDetailsContract } from '@url-checker/contracts';

import { jobApi, selectActiveJobId, selectActiveJobWasCreated, statusLabel } from '@entities/job';
import { CreateJobForm } from '@features/create-job';
import { JobDetails } from '@widgets/job-details';
import { JobList } from '@widgets/job-list';
import { JobsDashboard } from '@widgets/jobs-dashboard';

import styles from './JobsPage.module.css';

function getJobAnnouncement(details: JobDetailsContract | undefined, wasCreated: boolean): string {
  if (details === undefined) return wasCreated ? 'Job created. Loading details.' : '';

  const finishedCount = details.results.filter((result) =>
    ['success', 'error', 'cancelled'].includes(result.status),
  ).length;
  const context = wasCreated ? 'Job created.' : 'Job selected.';
  return `${context} Status: ${statusLabel(details.status)}. Progress: ${finishedCount} of ${details.urlCount} URLs finished.`;
}

export function JobsPage(): React.JSX.Element {
  const activeJobId = useSelector(selectActiveJobId);
  const activeJobWasCreated = useSelector(selectActiveJobWasCreated);
  const activeJobQuery = useSelector(jobApi.endpoints.getJob.select(activeJobId ?? ''));
  const announcement =
    activeJobId === null ? '' : getJobAnnouncement(activeJobQuery.data, activeJobWasCreated);

  return (
    <main>
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Link health monitor</p>
        <h1 className={styles.title}>Async URL Checker</h1>
        <p className={styles.subtitle}>
          Submit a batch of URLs, keep working, and watch each HEAD check settle independently.
        </p>
      </header>
      <JobsDashboard
        createJob={<CreateJobForm />}
        jobList={<JobList />}
        jobDetails={<JobDetails />}
      />
    </main>
  );
}
