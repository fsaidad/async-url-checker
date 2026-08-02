import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.MODE === 'test' ? 'http://localhost/api' : '/api',
  }),
  tagTypes: ['Job', 'JobList'],
  endpoints: () => ({}),
});
