import { configureStore } from '@reduxjs/toolkit';

import { jobsUiReducer, type JobsUiState } from '@entities/job';
import { baseApi } from '@shared/api';

export function createAppStore(activeJobId: string | null = null) {
  const preloadedState: { jobsUi: JobsUiState } = {
    jobsUi: { activeJobId, activeJobWasCreated: false },
  };
  const store = configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      jobsUi: jobsUiReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    preloadedState,
  });
  return store;
}

export const appStore = createAppStore();
export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
