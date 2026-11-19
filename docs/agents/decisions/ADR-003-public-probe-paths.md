# ADR-003 — Public probe paths, auth challenge only on POST /convert

## Status
Accepted

## Context
The container must be healthcheckable with and without `API_KEYS` configured, and the service is exposed to internet scanners. Challenging every route would make Docker/LB probes fail when auth is on and would reveal auth mode to unknown-path scanners.

## Decision
`isPublicPath()` exempts `OPTIONS`, `GET /health` and `GET /robots.txt` from both rate limiting and authentication. The auth middleware only challenges `POST /convert`; every other path falls through to a silent `404 { error: "Not found" }`. The `404` is also excluded from logging so scanner traffic does not pollute logs.

## Consequences
- Healthchecks work identically in open and authenticated modes.
- Unauthenticated callers cannot distinguish "auth enabled" from "auth disabled" by probing random paths.
- `GET /robots.txt` is always reachable and always disallows crawling.
- Only the conversion endpoint is protected; new state-changing routes must be added to the auth middleware explicitly or they will ship unprotected.
- Preflight never requires credentials, which is required for browsers to send `x-api-key` on the actual request.

## Evidence
- `src/index.ts` — `isPublicPath`, auth middleware, CORS middleware, robots route, catch-all.
- `README.md` — `/health` documented as public and excluded from rate limiting.
