import type { JobsUiState } from './jobs-ui.slice';

export const selectActiveJobId = (state: { jobsUi: JobsUiState }): string | null =>
  state.jobsUi.activeJobId;
