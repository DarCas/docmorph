# Testing and verification

The service and website have no test runner and no lint config; `tsc` is the only automated static check. The SDK is the exception: `node:test` plus `.github/workflows/sdk.yml`. Do not add a framework anywhere unless the task explicitly asks for one.

## Static checks

- Service: `npm run typecheck` (root, `tsc -p tsconfig.json --noEmit`).
- Service build: `npm run build` then optionally `npm start`.
- Website: `cd website && npm run build` — runs `highlight.mjs`, `tsc --noEmit`, `vite build`, `prerender.mjs`.
- SDK: `cd sdk && npm run typecheck && npm test` — `pretest` builds both output trees, then `node --test` runs against `dist/`.

## Local limits

`soffice` exists only in the Docker image. `npm run dev` exercises routing, auth, rate limiting, Multer limits and validation up to the `soffice` call, but `POST /convert` always ends in `500 CONVERSION_FAILED`. Never report a conversion fix as verified on a local run.

## End-to-end check (Docker)

`docker-compose.yml` has an `image:` but no `build:` stanza, so `docker compose up --build` does not rebuild the app. Build explicitly first:

```bash
docker build -t ghcr.io/darcas/docmorph:latest .
docker compose up -d
curl -s localhost:3001/health
curl -s -o out.pdf \
  -H "x-api-key: <key from docker-compose.yml>" \
  -F "file=@document.docx" \
  localhost:3001/convert
head -c 4 out.pdf   # must be %PDF
docker compose logs -f api
docker compose down
```

The tracked compose file maps `3001:8080`. A standalone `docker run -p 8080:8080 ...` serves on `8080` instead. A fresh clone only has `docker-compose.dist.yml`, and Compose does not load that name automatically: use `docker compose -f docker-compose.dist.yml up -d`.

For an SDK end-to-end run, build `sdk/`, point `DocMorphClient` at `http://localhost:3001`, convert a real `.docx` and assert the output starts with `%PDF`. The procedure is in [SDK](sdk.md#end-to-end-check-docker). The SDK test suite uses a mock server and proves nothing about `soffice`.

## Manual error-path checks

| Case | Expected |
| --- | --- |
| `POST /convert` with no form field | `412` |
| `POST /convert` with `file.txt` | `412` |
| `POST /convert` with a non-ZIP file named `.docx` | `415` |
| `POST /convert` without/with wrong key when `API_KEYS` is set | `401` |
| More than `RATE_LIMIT_MAX` non-public requests in the window | `429` |
| `GET /health` while auth is enabled | `200` without a key |
| Unknown path | `404` JSON, never `401` |

## What has no coverage

- PDF rendering fidelity and font substitution.
- Concurrent conversion isolation beyond the profile-per-job design.
- Timeout behaviour under real load.
- Website API copy drifting from the service (no build-time cross-check).
- SDK real-service behaviour outside Docker; the suite mocks every response.
- SDK browser runtime and cross-origin header exposure; CI runs Node only.
- SDK drift from the service: route, status and body changes are mirrored by hand.
