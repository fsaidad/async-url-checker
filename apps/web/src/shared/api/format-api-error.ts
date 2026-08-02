import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === 'object' && error !== null && 'status' in error;
}

export function isTransientApiError(error: unknown): boolean {
  if (!isFetchBaseQueryError(error)) return false;
  if (typeof error.status === 'number') return error.status >= 500;
  if (error.status === 'PARSING_ERROR') return error.originalStatus >= 500;
  return error.status === 'FETCH_ERROR' || error.status === 'TIMEOUT_ERROR';
}

export function formatApiError(error: unknown): string {
  if (!isFetchBaseQueryError(error)) return 'Something went wrong. Please try again.';
  if (typeof error.status === 'number') {
    const data = error.data;
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = data.message;
      if (Array.isArray(message)) return message.join('. ');
      if (typeof message === 'string') return message;
    }
    return `Request failed with status ${error.status}`;
  }
  return error.error;
}
