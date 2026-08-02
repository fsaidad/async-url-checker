import type {
  CancelJobResponse,
  CreateJobRequest,
  CreateJobResponse,
  JobDetails,
  JobListItem,
} from '@url-checker/contracts';

import { baseApi } from '@shared/api';

export const jobApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getJobs: builder.query<JobListItem[], void>({
      query: () => '/jobs',
      providesTags: [{ type: 'JobList', id: 'LIST' }],
    }),
    getJob: builder.query<JobDetails, string>({
      query: (id) => `/jobs/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Job', id }],
    }),
    createJob: builder.mutation<CreateJobResponse, CreateJobRequest>({
      query: (body) => ({ url: '/jobs', method: 'POST', body }),
      invalidatesTags: [{ type: 'JobList', id: 'LIST' }],
    }),
    cancelJob: builder.mutation<CancelJobResponse, string>({
      query: (id) => ({ url: `/jobs/${id}`, method: 'DELETE' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(jobApi.util.upsertQueryData('getJob', id, data));
          dispatch(
            jobApi.util.updateQueryData('getJobs', undefined, (jobs) => {
              const summary = jobs.find((job) => job.id === id);
              if (summary !== undefined) {
                summary.status = data.status;
                summary.statistics = data.statistics;
              }
            }),
          );
        } catch {
          // The mutation error is rendered by the cancel feature.
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Job', id },
        { type: 'JobList', id: 'LIST' },
      ],
    }),
  }),
});

export const { useGetJobsQuery, useGetJobQuery, useCreateJobMutation, useCancelJobMutation } =
  jobApi;
