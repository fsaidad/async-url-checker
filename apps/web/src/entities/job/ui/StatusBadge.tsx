import type { JobStatus } from '@url-checker/contracts';

import { statusLabel } from '../lib/job-status';
import styles from './StatusBadge.module.css';

const icons: Record<JobStatus, string> = {
  pending: '○',
  in_progress: '↻',
  completed: '✓',
  cancelled: '⊘',
  failed: '!',
};

export function StatusBadge({ status }: { status: JobStatus }): React.JSX.Element {
  return (
    <span className={`${styles.badge} ${styles[status]}`} data-icon={icons[status]}>
      {statusLabel(status)}
    </span>
  );
}
