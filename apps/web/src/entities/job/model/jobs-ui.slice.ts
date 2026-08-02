import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface JobsUiState {
  activeJobId: string | null;
  activeJobWasCreated: boolean;
}

const initialState: JobsUiState = { activeJobId: null, activeJobWasCreated: false };

const jobsUiSlice = createSlice({
  name: 'jobsUi',
  initialState,
  reducers: {
    setActiveJobId(state, action: PayloadAction<string | null>) {
      state.activeJobId = action.payload;
      state.activeJobWasCreated = false;
    },
    setCreatedJobActive(state, action: PayloadAction<string>) {
      state.activeJobId = action.payload;
      state.activeJobWasCreated = true;
    },
  },
});

export const { setActiveJobId, setCreatedJobActive } = jobsUiSlice.actions;
export const jobsUiReducer = jobsUiSlice.reducer;
