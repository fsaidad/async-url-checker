import type { JobsUiState } from './jobs-ui.slice';

export const selectActiveJobId = (state: { jobsUi: JobsUiState }): string | null =>
  state.jobsUi.activeJobId;

export const selectActiveJobWasCreated = (state: { jobsUi: JobsUiState }): boolean =>
  state.jobsUi.activeJobWasCreated;
