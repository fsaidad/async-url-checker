import { CreateJobForm } from '@features/create-job';
import { JobDetails } from '@widgets/job-details';
import { JobList } from '@widgets/job-list';
import { JobsDashboard } from '@widgets/jobs-dashboard';

import styles from './JobsPage.module.css';

export function JobsPage(): React.JSX.Element {
  return (
    <main>
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
