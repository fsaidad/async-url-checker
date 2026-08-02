export const ACTIVE_JOB_POLLING_MS = import.meta.env.MODE === 'test' ? 40 : 1_000;
export const ACTIVE_JOB_RECOVERY_POLLING_MS = import.meta.env.MODE === 'test' ? 120 : 5_000;
export const JOB_LIST_POLLING_MS = import.meta.env.MODE === 'test' ? 0 : 3_000;
