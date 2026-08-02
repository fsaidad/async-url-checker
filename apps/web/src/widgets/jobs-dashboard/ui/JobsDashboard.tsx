import type { ReactNode } from 'react';

import styles from './JobsDashboard.module.css';

interface JobsDashboardProps {
  createJob: ReactNode;
  jobList: ReactNode;
  jobDetails: ReactNode;
}

export function JobsDashboard({
  createJob,
  jobList,
  jobDetails,
}: JobsDashboardProps): React.JSX.Element {
  return (
    <div className={styles.dashboard}>
      <section className={`${styles.panel} ${styles.create}`} aria-labelledby="create-heading">
        <h2 id="create-heading">New check</h2>
        {createJob}
      </section>
      <section className={`${styles.panel} ${styles.list}`} aria-labelledby="jobs-heading">
        <h2 id="jobs-heading">Recent jobs</h2>
        {jobList}
      </section>
      <section className={`${styles.panel} ${styles.details}`} aria-labelledby="details-heading">
        <h2 id="details-heading">Job details</h2>
        {jobDetails}
      </section>
    </div>
  );
}
