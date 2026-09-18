# AGENTS.md

DOCX→PDF HTTP conversion worker (Express + headless LibreOffice). `src/` is the whole app: `index.ts` (routes), `convert.ts` (soffice wrapper), `concurrency.ts` (semaphore), `logger.ts`. Rate limiting via `express-rate-limit` (see `limiter` in `index.ts`).

## Commands

- `npm run dev` — `tsx watch src/index.ts` (local dev, no reload config needed)
- `npm run typecheck` — `tsc --noEmit` (only static check; no lint/test suite exists)
- `npm run build && npm start` — compile `src/` → `dist/`, run `node dist/index.js`
- `docker compose up --build` — full verification (only env with `soffice` + fonts)
- Release: `docker build -t ghcr.io/darcas/docmorph:latest . && docker push ghcr.io/darcas/docmorph:latest` (personal release script stays local, gitignored)

Node `>=22` (see `.nvmrc`: `22.23`). ESM (`"type": "module"`, `NodeNext`): relative imports must keep `.js` suffix (e.g. `./concurrency.js`).

## Env (`PORT`, `MAX_FILE_SIZE`, `CONVERT_TIMEOUT_MS`, `MAX_CONCURRENT`, `API_KEYS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`)

Defaults: `8080`, `10MiB`, `60s`, `3`, unset (open), `60s`, `60 req`. `GET /health` exposes active/queued/max + limits + `authEnabled` — use it to check load.

Auth: `API_KEYS` is an optional comma-separated list (`API_KEYS="k1,k2"`). Empty/unset = open (warns at startup). When set, every route **except `GET /health`** (always public, no auth, no rate limit — Docker healthcheck safe) requires `x-api-key: <k>` or `Authorization: Bearer <k>` (SHA-256 + `timingSafeEqual` compare), else `401`.

Rate limit: `express-rate-limit` (`limiter` in `index.ts`, default key = client IP), `GET /health` excluded via `skip`. Over limit → `429 { error: "Too many requests" }` + `Retry-After` + `RateLimit-*` headers (library sets them). Behind a reverse proxy all traffic shares one bucket (no `trust proxy`) — raise the limit or rate-limit at the proxy instead.

## Gotchas

- `soffice` exists only in the Docker image (`libreoffice-core` + `libreoffice-writer`). Local `npm run dev` serves routes but `POST /convert` always fails with `CONVERSION_FAILED` outside Docker. Do not "fix" conversion locally — test via Docker.
- `convert.ts` runs `soffice --headless --convert-to pdf` with a per-job `-env:UserInstallation=file://<tmp/lo-<uuid>/profile>`. Required for concurrent conversions; never share/reuse profiles.
- Only `.docx` is accepted: extension check (`isSupportedDocument`) + ZIP magic `PK\x03\x04` check + `%PDF` magic assert on output. Error mapping: `UNSUPPORTED_TYPE`→400, `INVALID_CONTENT`→415, else 500.
- Upload: `multer.memoryStorage()`, single field named `file`. Response is `application/pdf` with sanitized `filename="<base>.pdf"` (`sanitizeBaseName`: `[^A-Za-z0-9._-]`→`-`).
- Concurrency is a custom `Semaphore` in `concurrency.ts` (`MAX_CONCURRENT`); always `release()` in `finally` (see `index.ts`).
- Fonts in `fonts/msttcorefonts/` are gitignored but `COPY`d into the image + `fc-cache`. Missing fonts only affect PDF rendering fidelity, not build.
- Logging: `Logger(requestId)` key=value lines to stdout/stderr; no log library.
