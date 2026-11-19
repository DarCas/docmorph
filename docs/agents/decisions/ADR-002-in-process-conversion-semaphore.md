# ADR-002 — In-process semaphore for conversion concurrency

## Status
Accepted

## Context
A `soffice` conversion is CPU- and memory-heavy. Accepting unbounded parallel uploads would let a burst exhaust the container and make every conversion time out. The service is stateless and has no external queue.

## Decision
Bound concurrency with an in-process FIFO counting semaphore (`src/concurrency.ts`), sized by `MAX_CONCURRENT` (default `3`). The route acquires a slot before conversion and always releases it in `finally`. `/health` exposes `active`, `queued` and `max`.

## Consequences
- Work above capacity waits in memory instead of overloading LibreOffice.
- The queue is unbounded and unbounded in time: there is no queue timeout, rejection threshold or backpressure other than IP rate limiting.
- The limit is per process. Running multiple replicas multiplies total concurrency; nothing coordinates across containers.
- A leaked slot permanently reduces throughput, hence the release-in-`finally` requirement.
- `Semaphore` floors non-integers and clamps values below `1`, so a bad env value cannot construct a deadlocked pool.

## Evidence
- `src/concurrency.ts` — `Semaphore` implementation and FIFO handover.
- `src/index.ts` — pool construction, `acquire`/`release` in `POST /convert`, health reporting.
