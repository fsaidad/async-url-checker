import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface JobsUiState {
  activeJobId: string | null;
}

const initialState: JobsUiState = { activeJobId: null };

const jobsUiSlice = createSlice({
  name: 'jobsUi',
  initialState,
  reducers: {
    setActiveJobId(state, action: PayloadAction<string | null>) {
      state.activeJobId = action.payload;
    },
  },
});

export const { setActiveJobId } = jobsUiSlice.actions;
export const jobsUiReducer = jobsUiSlice.reducer;
