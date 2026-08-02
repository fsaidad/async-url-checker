export const ACTIVE_JOB_POLLING_MS = import.meta.env.MODE === 'test' ? 40 : 1_000;
export const JOB_LIST_POLLING_MS = import.meta.env.MODE === 'test' ? 0 : 3_000;
