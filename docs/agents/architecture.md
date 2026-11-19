# Architecture

## System shape

Three independent deliverables in one repository:

- **Conversion service** — a stateless Express app in `src/`, compiled to `dist/`, shipped as one Docker image.
- **Landing site** — a static React/Vite site in `website/`, prerendered at build time and deployed to GitHub Pages.
- **SDK** — `@darcas/docmorph-sdk` in `sdk/`, a zero-dependency isomorphic client published to npm.

They share no code and no runtime dependency. The site only contains copied code snippets; it never calls the API. The SDK talks to the service over HTTP and is versioned and released independently.

## Conversion service

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Configuration constants, middleware chain, all routes, error handler, startup banner. |
| `src/convert.ts` | Input validation, temp job directory, `soffice` subprocess, PDF assertion, cleanup. |
| `src/concurrency.ts` | FIFO counting semaphore (`Semaphore`) bounding concurrent conversions. |
| `src/logger.ts` | Request-scoped `key=value` logger writing to stdout/stderr. |

Dependency direction is one-way: `index.ts` imports `convert.ts`, `concurrency.ts`, `logger.ts`; `convert.ts` depends only on Node built-ins and spawns `soffice`; `concurrency.ts` and `logger.ts` depend on nothing internal.

### Request pipeline order

Middleware order in `src/index.ts` is significant:

1. `app.disable('x-powered-by')`, `app.set('trust proxy', 1)`.
2. Logging middleware — attaches `req.logger = new Logger(randomUUID())`. Must stay first.
3. `limiter` — `express-rate-limit` fixed window; skips public paths.
4. Auth middleware — short-circuits `401` only for `POST /convert` when `API_KEYS` is set.
5. CORS preflight — any `OPTIONS` answered `204` with permissive headers.
6. Routes: `GET /health`, `GET /robots.txt`, `POST /convert`.
7. Catch-all — silent `404 { error: "Not found" }`.
8. Typed error handler — must stay last.

Consequence: rate limiting runs before auth, so rejected `401` requests still consume the caller's IP budget, and an unknown path is answered by the catch-all without an auth challenge.

### Conversion lifecycle

1. Route checks the `file` field exists and the extension is `.docx`; both failures answer `412` before touching the pool.
2. `pool.acquire()` yields a release function; the caller waits in FIFO order when saturated.
3. `convertDocxToPdf(buffer, originalname, { timeoutMs })`:
   - re-validates extension (`UNSUPPORTED_TYPE`) and ZIP magic (`INVALID_CONTENT`);
   - creates `os.tmpdir()/lo-<uuid>/` with a `profile/` subdirectory;
   - writes `<sanitized-base>.docx`, runs `soffice --headless --convert-to pdf --outdir <jobDir> -env:UserInstallation=file://<jobDir>/profile <source>`;
   - reads `<sanitized-base>.pdf`, asserts the `%PDF` magic header;
   - removes the job directory in `finally` (not awaited; failures ignored).
4. The route sanitizes the output filename and sends `application/pdf` with `Content-Disposition: inline`.
5. `release()` runs in `finally` whether conversion succeeded or threw.

There is no queue persistence, no job store, and no session: if the process dies, queued and in-flight conversions are lost.

### Failure mapping

| Error | Status |
| --- | --- |
| `ConversionError` code `UNSUPPORTED_TYPE` | `400` |
| `ConversionError` code `INVALID_CONTENT` | `415` |
| Any other `ConversionError` (e.g. `CONVERSION_FAILED`) | `500` |
| `multer.MulterError` (size limit, wrong field, too many files) | `400` |
| Anything else | `500` with a generic message |

`UNSUPPORTED_TYPE` is normally unreachable through HTTP because the route pre-checks the extension and answers `412`; the code remains for direct callers of `convertDocxToPdf`.

### Trust and rate-limit keying

`trust proxy` is `1`, matching a single reverse proxy hop in front of the container (the deploy comment names Apache `ProxyPass` to `localhost:3001`). `req.ip` therefore comes from the last `X-Forwarded-For` entry. Changing the number of hops silently changes rate-limit bucketing and should be treated as a deployment change.

## SDK (`sdk/`)

`@darcas/docmorph-sdk` is an independent npm package: zero runtime dependencies, ESM + CJS, browser and Node. It shares no code with the service and mirrors the HTTP contract by hand.

| Piece | Responsibility |
| --- | --- |
| `sdk/src/types.d.ts` | Single source of every public type. |
| `sdk/src/client.ts` | `DocMorphClient`: input validation, multipart upload, health, retries, timeouts, abort, status-to-code mapping. |
| `sdk/src/errors.ts` | `DocMorphError` with a stable `code` discriminant. |
| `sdk/src/node.ts` | `convertFile` filesystem helper, exported as `./node`. |
| `sdk/scripts/postbuild.mjs` | Copies `types.d.ts` into both output trees and marks the CJS tree. |

Build order (`sdk/package.json`): clean → ESM `tsc` → CJS `tsc` → postbuild. Tests use `node:test` against `dist/` with a local mock server; there is no build-time dependency on the service. See [SDK](sdk.md).

## Landing site

Build order (`website/package.json`): `scripts/highlight.mjs` → `tsc --noEmit` → `vite build` → `scripts/prerender.mjs`.

| Piece | Responsibility |
| --- | --- |
| `website/index.html` | Hand-written SEO meta, Open Graph, Twitter tags, JSON-LD graph (`WebSite`, `Organization`, `SoftwareApplication`). |
| `website/vite.config.ts` | React plugin, optional SRI plugin, version injection, sitemap `lastmod`. |
| `website/scripts/snippets.mjs` | Source of truth for the code examples shown on the page. |
| `website/scripts/highlight.mjs` | Shiki (`vitesse-dark`) → `website/src/generated/snippets.json`. |
| `website/scripts/prerender.mjs` | SSR-renders `App` via Vite and injects markup into `dist/index.html`. |
| `website/src/main.tsx` | Loads fonts and CSS; `hydrateRoot` when prerendered markup exists, otherwise `createRoot`. |

Version injection: `vite.config.ts` defines `__SITE_VERSION__` (website `package.json`) and `__SOFTWARE_VERSION__` (root `package.json`), and rewrites the JSON-LD `"softwareVersion"` placeholder during `transformIndexHtml`. `SitemapLastmod` writes the build date into `dist/sitemap.xml` in `closeBundle`.

The site and the SDK have no source of truth for API behavior. Snippets, copy and the client's status/error mapping must be updated manually when the API changes; neither build fails if they drift.
