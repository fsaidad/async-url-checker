import { isTransientApiError } from './format-api-error';

describe('isTransientApiError', () => {
  it.each([
    [{ status: 503, data: { message: 'unavailable' } }, true],
    [{ status: 'FETCH_ERROR', error: 'offline' }, true],
    [{ status: 'TIMEOUT_ERROR', error: 'timed out' }, true],
    [{ status: 'PARSING_ERROR', originalStatus: 503, data: '', error: 'invalid JSON' }, true],
    [{ status: 404, data: { message: 'not found' } }, false],
    [{ status: 'PARSING_ERROR', originalStatus: 200, data: '', error: 'invalid JSON' }, false],
    [{ status: 'CUSTOM_ERROR', error: 'custom' }, false],
  ])('classifies %o as transient=%s', (error, expected) => {
    expect(isTransientApiError(error)).toBe(expected);
  });
});
