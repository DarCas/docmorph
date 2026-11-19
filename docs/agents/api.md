# HTTP API

Base URL is whatever host/port the container is published on. All routes are JSON unless noted.

## Routes

| Method | Path | Auth | Rate limited | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | public | no | JSON status |
| `GET` | `/robots.txt` | public | no | `text/plain`, `User-agent: *` / `Disallow: /` |
| `OPTIONS` | any | public | no | `204`, CORS headers |
| `POST` | `/convert` | required when `API_KEYS` set | yes | `application/pdf` |
| any | anything else | not challenged | yes | `404 { error: "Not found" }` |

Public paths are defined by `isPublicPath()` in `src/index.ts`: any `OPTIONS`, plus `GET /health` and `GET /robots.txt`. The auth middleware additionally only challenges `POST /convert`, so unmapped paths return `404` rather than `401` even when auth is enabled.

## Configuration effects

All values are read once at startup; changing them requires a restart. Defaults: `PORT=8080`, `MAX_FILE_SIZE=10485760` (10 MiB), `CONVERT_TIMEOUT_MS=60000`, `MAX_CONCURRENT=3`, `API_KEYS` unset (open), `RATE_LIMIT_WINDOW_MS=60000`, `RATE_LIMIT_MAX=60`. `README.md` mirrors the same table for users.

## Authentication

- `API_KEYS` is a comma-separated list; entries are trimmed and empty entries dropped.
- Empty or unset means open access; the startup banner prints `auth: disabled (open)`.
- Accepted credentials: `x-api-key: <key>` (takes precedence) or `Authorization: Bearer <key>`.
- Keys are hashed with SHA-256 and compared using `timingSafeEqual`; multiple keys are allowed.
- Failure: `401 { error: "Unauthorized" }`.
- `GET /health` and `GET /robots.txt` never require a key, so healthchecks work in both modes.

## Rate limiting

- `express-rate-limit` v8, in-memory default store, per client IP.
- Fixed window: `RATE_LIMIT_WINDOW_MS` (default `60000`), max `RATE_LIMIT_MAX` (default `60`).
- `standardHeaders: 'draft-8'`, `legacyHeaders: false` — emits `RateLimit` / `RateLimit-Policy`, not `X-RateLimit-*`.
- Over the limit: `429 { error: "Too many requests" }` plus `Retry-After` and the standard headers set by the library. The handler also logs a `WARN`.
- Public paths are skipped. The bucket is shared by every non-public request, including `401`s, since the limiter runs before auth.
- With `trust proxy` = `1`, the client IP is taken from the last `X-Forwarded-For` hop. Multiple proxies collapse callers into one bucket.

## `GET /health`

No auth, no rate limit, no logging. Exact payload:

```json
{
  "authEnabled": true,
  "concurrency": { "active": 0, "queued": 0, "max": 3 },
  "maxFileSize": 10485760,
  "rateLimit": { "max": 60, "windowMs": 60000 },
  "status": "ok",
  "timeoutMs": 60000
}
```

`concurrency` is read live from the semaphore. Use it to detect saturation before sending work.

## `POST /convert`

Multipart body with exactly one field named `file`. Multer uses memory storage and enforces `files: 1` and `fileSize: MAX_FILE_SIZE`.

Accepted input: filename ending in `.docx` (case-insensitive) and content starting with `PK\x03\x04`.

Success: `200`, `Content-Type: application/pdf`, `Content-Disposition: inline; filename="<base>.pdf"`. The base name is derived by stripping `.docx` and sanitizing with `sanitizeBaseName`: every run outside `[A-Za-z0-9._-]` becomes `-`, leading/trailing dots and dashes are trimmed, and an empty result falls back to `document`.

### Status codes

| Status | Cause |
| --- | --- |
| `401` | Auth enabled and no valid key |
| `412` | Missing `file` field, or filename does not end in `.docx` |
| `415` | Buffer does not start with `PK\x03\x04` |
| `429` | Rate limit exceeded |
| `500` | `soffice` failed/timed out, produced no file, or the output lacks `%PDF` |

Multer failures (e.g. `LIMIT_FILE_SIZE`) are handled by the error middleware as `400 { error: <multer message> }` — not documented in the README table, which lists `412` for unsupported input only.

The response deliberately does not expose `soffice` stderr; it is logged server-side under the `convert failed` record.

## CORS

`OPTIONS` returns `204` with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization`, and `Allow`. Preflight is intentionally unauthenticated so browsers can probe `POST /convert` with the non-safelisted `x-api-key` header.
