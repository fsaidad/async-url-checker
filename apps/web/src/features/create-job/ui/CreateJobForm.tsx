import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { MAX_URLS_PER_JOB } from '@url-checker/contracts';

import { setCreatedJobActive, useCreateJobMutation } from '@entities/job';
import { formatApiError } from '@shared/api';
import { Button } from '@shared/ui/button';

import { parseUrls } from '../lib/parse-urls';
import styles from './CreateJobForm.module.css';

export function CreateJobForm(): React.JSX.Element {
  const dispatch = useDispatch();
  const [input, setInput] = useState('');
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [createJob, { isLoading, error: requestError, reset: resetRequest }] =
    useCreateJobMutation();

  function changeInput(value: string): void {
    setInput(value);
    setClientErrors([]);
    setDuplicateCount(0);
    resetRequest();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = parseUrls(input);
    setClientErrors(parsed.errors);
    setDuplicateCount(parsed.duplicateCount);
    if (parsed.errors.length > 0) return;

    try {
      const created = await createJob({ urls: parsed.urls }).unwrap();
      dispatch(setCreatedJobActive(created.jobId));
    } catch {
      // RTK Query exposes the error below and keeps the submitted input for retry.
    }
  }

  const errors = [
    ...clientErrors,
    ...(requestError === undefined ? [] : [formatApiError(requestError)]),
  ];

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <label className={styles.label} htmlFor="job-urls">
        URLs to check
        <span className={styles.hint}>
          One http:// or https:// URL per line, up to {MAX_URLS_PER_JOB}.
        </span>
      </label>
      <textarea
        className={styles.textarea}
        id="job-urls"
        name="urls"
        value={input}
        onChange={(event) => changeInput(event.target.value)}
        aria-invalid={errors.length > 0}
        aria-describedby={errors.length > 0 ? 'url-errors' : 'url-hint'}
        placeholder={'https://example.com\nhttps://example.com/missing'}
        disabled={isLoading}
      />
      <span className={styles.hint} id="url-hint">
        Duplicate lines are removed before the job is submitted.
      </span>
      {duplicateCount > 0 ? (
        <p className={styles.notice} role="status">
          Removed {duplicateCount} duplicate {duplicateCount === 1 ? 'line' : 'lines'}.
        </p>
      ) : null}
      {errors.length > 0 ? (
        <ul className={styles.errors} id="url-errors" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      <Button type="submit" disabled={isLoading} fullWidth>
        {isLoading ? 'Creating job…' : 'Start checking'}
      </Button>
    </form>
  );
}
