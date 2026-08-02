import type { PropsWithChildren } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { selectActiveJobId, setActiveJobId } from '@entities/job';

interface SelectJobButtonProps extends PropsWithChildren {
  jobId: string;
  className?: string | undefined;
}

export function SelectJobButton({
  jobId,
  className,
  children,
}: SelectJobButtonProps): React.JSX.Element {
  const dispatch = useDispatch();
  const activeJobId = useSelector(selectActiveJobId);
  return (
    <button
      type="button"
      className={className}
      aria-pressed={activeJobId === jobId}
      onClick={() => dispatch(setActiveJobId(jobId))}
    >
      {children}
    </button>
  );
}
