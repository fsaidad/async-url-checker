import type { JobStatus } from '@url-checker/contracts';

import { isTerminalJobStatus, useCancelJobMutation } from '@entities/job';
import { formatApiError } from '@shared/api';
import { Button } from '@shared/ui/button';

export function CancelJobButton({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}): React.JSX.Element | null {
  const [cancel, { isLoading, error }] = useCancelJobMutation();
  if (isTerminalJobStatus(status)) return null;

  return (
    <div>
      <Button
        type="button"
        variant="danger"
        disabled={isLoading}
        onClick={() => void cancel(jobId)}
      >
        {isLoading ? 'Cancelling…' : 'Cancel job'}
      </Button>
      {error === undefined ? null : <p role="alert">{formatApiError(error)}</p>}
    </div>
  );
}
