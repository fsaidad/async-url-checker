import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import type { JobDetails as JobDetailsContract, JobStatus } from '@url-checker/contracts';

import { jobApi, setActiveJobId } from '@entities/job';
import { ACTIVE_JOB_POLLING_MS } from '@shared/config';
import { JobDetails } from '@widgets/job-details';

import { App } from './App';
import { createAppStore } from './store';
import { server } from './test';

const createdAt = '2026-08-02T05:00:00.000Z';
const apiUrl = (path: string): string => `http://localhost/api${path}`;

function jobDetails(id: string, status: JobStatus, url = `https://${id}.test`): JobDetailsContract {
  const resultStatus =
    status === 'completed' ? 'success' : status === 'cancelled' ? 'cancelled' : 'in_progress';
  return {
    id,
    createdAt,
    startedAt: createdAt,
    finishedAt: status === 'completed' || status === 'cancelled' ? createdAt : null,
    status,
    urlCount: 1,
    statistics: { success: status === 'completed' ? 1 : 0, error: 0 },
    results: [
      {
        id: `${id}-result`,
        url,
        status: resultStatus,
        statusCode: status === 'completed' ? 200 : null,
        error: null,
        startedAt: createdAt,
        finishedAt: status === 'completed' || status === 'cancelled' ? createdAt : null,
        durationMs: status === 'completed' ? 12 : null,
      },
    ],
  };
}

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}

type TestStore = ReturnType<typeof createAppStore>;

function deferred(): Deferred {
  let release: (() => void) | undefined;
  return {
    promise: new Promise<void>((resolve) => {
      release = resolve;
    }),
    resolve: () => release?.(),
  };
}

function waitForStore(store: TestStore, predicate: () => boolean): Promise<void> {
  if (predicate()) return Promise.resolve();

  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (!predicate()) return;
      unsubscribe();
      resolve();
    });
  });
}

function waitForJob(
  store: TestStore,
  id: string,
  predicate: (details: JobDetailsContract) => boolean,
): Promise<void> {
  return waitForStore(store, () => {
    const details = jobApi.endpoints.getJob.select(id)(store.getState()).data;
    return details !== undefined && predicate(details);
  });
}

async function advancePollingBy(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('jobs UI', () => {
  afterEach(() => vi.useRealTimers());
  it('validates, de-duplicates, creates, and activates a job', async () => {
    let submittedUrls: string[] = [];
    server.use(
      http.get(apiUrl('/jobs'), () => HttpResponse.json([])),
      http.post(apiUrl('/jobs'), async ({ request }) => {
        const body = (await request.json()) as { urls: string[] };
        submittedUrls = body.urls;
        return HttpResponse.json({ jobId: 'created-job' }, { status: 202 });
      }),
      http.get(apiUrl('/jobs/created-job'), () =>
        HttpResponse.json(jobDetails('created-job', 'completed', 'https://created.test')),
      ),
    );
    const user = userEvent.setup();
    render(
      <Provider store={createAppStore()}>
        <App />
      </Provider>,
    );

    await user.type(
      screen.getByLabelText(/URLs to check/i),
      'https://created.test{enter}https://created.test',
    );
    await user.click(screen.getByRole('button', { name: 'Start checking' }));

    expect(await screen.findByText('Removed 1 duplicate line.')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('job-details')).toHaveAttribute('data-job-id', 'created-job'),
    );
    expect(submittedUrls).toEqual(['https://created.test']);
  });

  it('selects a recent job and loads its keyed details', async () => {
    const selectable = jobDetails('selectable-job', 'completed');
    server.use(
      http.get(apiUrl('/jobs'), () =>
        HttpResponse.json([
          {
            id: selectable.id,
            createdAt: selectable.createdAt,
            status: selectable.status,
            urlCount: selectable.urlCount,
            statistics: selectable.statistics,
          },
        ]),
      ),
      http.get(apiUrl('/jobs/selectable-job'), () => HttpResponse.json(selectable)),
    );
    const user = userEvent.setup();
    render(
      <Provider store={createAppStore()}>
        <App />
      </Provider>,
    );

    const idLabel = await screen.findByTitle('selectable-job');
    const selectButton = idLabel.closest('button');
    expect(selectButton).not.toBeNull();
    if (selectButton !== null) await user.click(selectButton);

    await waitFor(() =>
      expect(screen.getByTestId('job-details')).toHaveAttribute('data-job-id', 'selectable-job'),
    );
  });

  it('shows a refresh warning when the cached job list is empty', async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl('/jobs'), () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json([])
          : HttpResponse.json({ message: 'jobs temporarily unavailable' }, { status: 503 });
      }),
    );
    const store = createAppStore();
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(
      await screen.findByText('No jobs yet. Add URLs above to start one.'),
    ).toBeInTheDocument();
    act(() => {
      store.dispatch(jobApi.util.invalidateTags([{ type: 'JobList', id: 'LIST' }]));
    });

    expect(await screen.findByText(/Latest jobs refresh failed:/i)).toHaveTextContent(
      'jobs temporarily unavailable',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByText('No jobs yet. Add URLs above to start one.')).toBeInTheDocument();
  });

  it('does not carry a late cancel state into a newly selected cached job', async () => {
    const cancelResponse = deferred();
    const lateResponseReturned = deferred();
    server.use(
      http.delete(apiUrl('/jobs/old-cancel-job'), async () => {
        await cancelResponse.promise;
        lateResponseReturned.resolve();
        return HttpResponse.json({ message: 'old cancellation failed' }, { status: 503 });
      }),
    );
    const store = createAppStore('old-cancel-job');
    store.dispatch(jobApi.internalActions.onFocusLost());
    await store.dispatch(
      jobApi.util.upsertQueryData(
        'getJob',
        'old-cancel-job',
        jobDetails('old-cancel-job', 'in_progress'),
      ),
    );
    await store.dispatch(
      jobApi.util.upsertQueryData(
        'getJob',
        'new-cancel-job',
        jobDetails('new-cancel-job', 'in_progress'),
      ),
    );
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <JobDetails />
      </Provider>,
    );

    expect(screen.getByTestId('job-details')).toHaveAttribute('data-job-id', 'old-cancel-job');
    await user.click(screen.getByRole('button', { name: 'Cancel job' }));
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled();

    act(() => {
      store.dispatch(setActiveJobId('new-cancel-job'));
    });
    expect(screen.getByTestId('job-details')).toHaveAttribute('data-job-id', 'new-cancel-job');
    expect(screen.getByRole('button', { name: 'Cancel job' })).toBeEnabled();

    await act(async () => {
      cancelResponse.resolve();
      await lateResponseReturned.promise;
      await Promise.resolve();
    });

    expect(screen.getByTestId('job-details')).toHaveAttribute('data-job-id', 'new-cancel-job');
    expect(screen.getByRole('button', { name: 'Cancel job' })).toBeEnabled();
    expect(screen.queryByText('old cancellation failed')).not.toBeInTheDocument();
  });

  it('polls the active job until it reaches a terminal state, then stops', async () => {
    let calls = 0;
    const terminalResponse = deferred();
    server.use(
      http.get(apiUrl('/jobs/polling-job'), async () => {
        calls += 1;
        await terminalResponse.promise;
        return HttpResponse.json(jobDetails('polling-job', 'completed'));
      }),
    );
    const store = createAppStore('polling-job');
    await store.dispatch(
      jobApi.util.upsertQueryData(
        'getJob',
        'polling-job',
        jobDetails('polling-job', 'in_progress'),
      ),
    );
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    render(
      <Provider store={store}>
        <JobDetails />
      </Provider>,
    );

    expect(screen.getAllByText('In progress')).toHaveLength(2);

    await advancePollingBy(0);
    await advancePollingBy(ACTIVE_JOB_POLLING_MS);
    expect(calls).toBe(1);

    await act(async () => {
      terminalResponse.resolve();
      await vi.waitFor(() => {
        expect(jobApi.endpoints.getJob.select('polling-job')(store.getState()).data?.status).toBe(
          'completed',
        );
      });
    });
    await advancePollingBy(0);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    const callsAtCompletion = calls;
    await advancePollingBy(ACTIVE_JOB_POLLING_MS * 3);
    expect(calls).toBe(callsAtCompletion);
  });

  it('keeps polling a cancelled job until its in-flight check settles', async () => {
    let calls = 0;
    const settlement = deferred();
    const cancelledDetails = (settled: boolean): JobDetailsContract => ({
      ...jobDetails('cancel-job', 'cancelled'),
      statistics: { success: settled ? 1 : 0, error: 0 },
      results: [
        {
          id: 'cancel-job-result',
          url: 'https://cancel-job.test',
          status: settled ? 'success' : 'in_progress',
          statusCode: settled ? 200 : null,
          error: null,
          startedAt: createdAt,
          finishedAt: settled ? createdAt : null,
          durationMs: settled ? 12 : null,
        },
      ],
    });
    server.use(
      http.get(apiUrl('/jobs/cancel-job'), async () => {
        calls += 1;
        await settlement.promise;
        return HttpResponse.json(cancelledDetails(true));
      }),
    );
    const store = createAppStore('cancel-job');
    await store.dispatch(
      jobApi.util.upsertQueryData('getJob', 'cancel-job', cancelledDetails(false)),
    );
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    render(
      <Provider store={store}>
        <JobDetails />
      </Provider>,
    );

    expect(screen.getByText('Waiting for in-flight checks to finish.')).toBeInTheDocument();

    await advancePollingBy(0);
    await advancePollingBy(ACTIVE_JOB_POLLING_MS);
    expect(calls).toBe(1);

    await act(async () => {
      settlement.resolve();
      await vi.waitFor(() => {
        expect(
          jobApi.endpoints.getJob.select('cancel-job')(store.getState()).data?.results[0]?.status,
        ).toBe('success');
      });
    });
    await advancePollingBy(0);
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('This job is terminal.')).toBeInTheDocument();
    const callsAtSettlement = calls;
    await advancePollingBy(ACTIVE_JOB_POLLING_MS * 3);
    expect(calls).toBe(callsAtSettlement);
  });

  it('keeps cached details visible when a background refresh fails', async () => {
    server.use(
      http.get(apiUrl('/jobs/stale-job'), () =>
        HttpResponse.json({ message: 'temporary failure' }, { status: 503 }),
      ),
    );
    const store = createAppStore('stale-job');
    await store.dispatch(
      jobApi.util.upsertQueryData(
        'getJob',
        'stale-job',
        jobDetails('stale-job', 'completed', 'https://cached.test'),
      ),
    );
    render(
      <Provider store={store}>
        <JobDetails />
      </Provider>,
    );

    expect(screen.getByText('https://cached.test')).toBeInTheDocument();
    const refreshFailed = waitForStore(
      store,
      () => jobApi.endpoints.getJob.select('stale-job')(store.getState()).status === 'rejected',
    );
    act(() => {
      store.dispatch(jobApi.util.invalidateTags([{ type: 'Job', id: 'stale-job' }]));
    });
    await act(async () => refreshFailed);

    expect(screen.getByText(/Latest update failed:/i)).toBeInTheDocument();
    expect(screen.getByText('https://cached.test')).toBeInTheDocument();
  });

  it('never lets a late old response replace the newly selected job', async () => {
    const oldResponse = deferred();
    const lateResponseReturned = deferred();
    let oldCalls = 0;
    server.use(
      http.get(apiUrl('/jobs/old-job'), async () => {
        oldCalls += 1;
        await oldResponse.promise;
        lateResponseReturned.resolve();
        return HttpResponse.json(jobDetails('old-job', 'in_progress', 'https://old.test'));
      }),
    );
    const store = createAppStore('old-job');
    await store.dispatch(
      jobApi.util.upsertQueryData(
        'getJob',
        'old-job',
        jobDetails('old-job', 'in_progress', 'https://old.test'),
      ),
    );
    await store.dispatch(
      jobApi.util.upsertQueryData(
        'getJob',
        'new-job',
        jobDetails('new-job', 'completed', 'https://new.test'),
      ),
    );
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    render(
      <Provider store={store}>
        <JobDetails />
      </Provider>,
    );
    expect(screen.getByText('https://old.test')).toBeInTheDocument();
    await advancePollingBy(0);
    await advancePollingBy(ACTIVE_JOB_POLLING_MS);
    expect(oldCalls).toBe(1);
    expect(jobApi.endpoints.getJob.select('old-job')(store.getState()).status).toBe('pending');

    act(() => {
      store.dispatch(setActiveJobId('new-job'));
    });
    await act(async () => {
      await waitForJob(store, 'new-job', (details) => details.status === 'completed');
    });
    expect(screen.getByText('https://new.test')).toBeInTheDocument();
    expect(screen.getByTestId('job-details')).toHaveAttribute('data-job-id', 'new-job');

    await act(async () => {
      oldResponse.resolve();
      await lateResponseReturned.promise;
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('job-details')).toHaveAttribute('data-job-id', 'new-job');
    expect(screen.queryByText('https://old.test')).not.toBeInTheDocument();
    await advancePollingBy(ACTIVE_JOB_POLLING_MS * 3);
    expect(oldCalls).toBe(1);
  });
});
