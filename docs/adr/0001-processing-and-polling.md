# ADR 0001: processing, cancellation, and polling semantics

Status: accepted

## Context

The service checks many URLs asynchronously, reports useful link health, supports cancellation, and
must remain correct when the UI switches quickly between jobs.

## Decisions

### HTTP response classification

Every URL is probed with `HEAD`. Responses in the `200–399` range are `success`. Responses in the
`400–599` range are `error`, with the HTTP status retained. A response such as 404 is therefore not a
network exception, but it is a broken-link result for the user-facing success/error statistics.
Timeouts, DNS failures, invalid TLS, and other transport failures are `error` with a normalized message
and no HTTP status.

### Per-job worker pool

Each job starts at most five worker loops. A worker atomically claims one pending URL from the
in-memory repository, performs `HEAD`, waits the configured random delay, commits the result, and then
claims again. Multiple jobs own independent pools and may run concurrently.

This intentionally avoids creating one promise per URL and makes both the concurrency cap and
cancellation boundary explicit.

### Cancellation

Cancellation moves the job to the terminal `cancelled` state immediately and marks all pending URL
items as cancelled. In-progress probes are not force-aborted: they finish and retain their individual
result, while the parent job remains cancelled. No worker can claim another URL after cancellation.
Terminal job states never transition back to a non-terminal state.

### Polling and stale responses

The frontend polls details only for the current `activeJobId`. It stops immediately at `completed` or
`failed`; after `cancelled`, it continues only while a URL is still pending or in progress, so final
results from already claimed probes become visible. Changing the id changes the RTK Query cache key and
unsubscribes the previous hook. A late response is stored only under its original job id and cannot
overwrite the active job's details.

## Consequences

- In-flight network work may continue briefly after cancellation, which avoids ambiguous partial abort
  handling and preserves an honest result for work already started.
- A server restart loses all jobs because persistence is intentionally out of scope.
- Sites that reject `HEAD` with 405 are reported as HTTP errors; no GET fallback is attempted because
  the assignment explicitly requires `HEAD`.
