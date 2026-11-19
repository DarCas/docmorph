# DocMorph

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=for-the-badge)
![Node.js](https://img.shields.io/badge/node.js-%3E%3D22.23.4-5FA04E?logo=nodedotjs&logoColor=white&style=for-the-badge)

[![Version](https://img.shields.io/github/v/tag/DarCas/docmorph?label=version&filter=v*&style=for-the-badge)](https://github.com/DarCas/docmorph/releases)
[![SDK](https://img.shields.io/npm/v/@darcas/docmorph-sdk?label=sdk&style=for-the-badge)](https://www.npmjs.com/package/@darcas/docmorph-sdk)

![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

[![Buy me a coffee](https://img.shields.io/badge/buy_me_a_coffee-%E2%9D%A4%EF%B8%8F-FEEBE7?style=for-the-badge&labelColor=FF0000)](https://www.paypal.com/donate/?hosted_button_id=YZQDE3TEYDBWA)

Stateless HTTP microservice that converts `.docx` documents to PDF using headless LibreOffice.
Single-purpose, container-first, and safe for concurrent use — upload a file, get a PDF back.

## Features

- **One endpoint, one job** — `POST /convert` accepts a `.docx` file and streams back
  `application/pdf`.
- **Hardened uploads** — extension check, OOXML/ZIP magic-byte validation, configurable size limit,
  and `%PDF` assertion on the output.
- **Concurrency control** — bounded conversion pool (semaphore) so LibreOffice never gets more work
  than it can handle.
- **Optional API-key auth** — when `API_KEYS` is set, `POST /convert` requires
  `x-api-key` or `Authorization: Bearer`; `/health` and `/robots.txt` stay public.
- **Rate limiting** — per-IP fixed window via `express-rate-limit` (`/health` and `/robots.txt`
  excluded).
- **Observable** — `GET /health` reports status, pool load, limits, and whether auth is enabled.

## Quick start

```bash
docker run -d --name docmorph \
  -p 8080:8080 \
  -e API_KEYS="your-secret-key" \
  ghcr.io/darcas/docmorph:latest
```

Or with the tracked Docker Compose template, which publishes port `3001`:

```bash
docker compose -f docker-compose.dist.yml up -d
```

Set `API_KEYS` in the compose file (or your own `docker-compose.yml`) to enable auth.

## Convert a document:

The examples below use `localhost:8080`, the port of the `docker run` command above.
With the compose template, replace `8080` with `3001`.

#### cURL

```bash
curl -o out.pdf \
  -H "x-api-key: your-secret-key" \
  -F "file=@document.docx;type=application/vnd.openxmlformats-officedocument.wordprocessingml.document" \
  http://localhost:8080/convert
```

#### TypeScript (native `fetch`, Node ≥ 22.23.4)

```ts
import {readFile, writeFile} from 'node:fs/promises';

const docx = await readFile('document.docx');
const form = new FormData();
form.append('file', new Blob([docx], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}), 'document.docx');

const res = await fetch('http://localhost:8080/convert', {
    method: 'POST',
    headers: {'x-api-key': process.env.DOCMORPH_API_KEY!},
    body: form,
});

if (!res.ok) throw new Error(`convert failed: ${res.status}`);
await writeFile('out.pdf', Buffer.from(await res.arrayBuffer()));
```

#### Python (`requests`)

```python
import os
import requests

with open('document.docx', 'rb') as f:
    res = requests.post(
        'http://localhost:8080/convert',
        headers={'x-api-key': os.environ['DOCMORPH_API_KEY']},
        files={'file': ('document.docx', f,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document')},
        timeout=90,
    )
res.raise_for_status()

with open('out.pdf', 'wb') as f:
    f.write(res.content)
```

## Configuration

All settings are environment variables:

| Variable               | Default    | Description                                         |
|------------------------|------------|-----------------------------------------------------|
| `API_KEYS`             | *(unset)*  | Comma-separated API keys; unset means open access   |
| `CONVERT_TIMEOUT_MS`   | `60000`    | Per-conversion LibreOffice timeout                  |
| `MAX_CONCURRENT`       | `3`        | Max simultaneous conversions                        |
| `MAX_FILE_SIZE`        | `10485760` | Max upload size in bytes (10 MiB)                   |
| `PORT`                 | `8080`     | HTTP listen port                                    |
| `RATE_LIMIT_MAX`       | `60`       | Max requests per window per IP (`/health` and `/robots.txt` excluded) |
| `RATE_LIMIT_WINDOW_MS` | `60000`    | Rate-limit window per client IP                     |

## API

### `GET /health`

Public, unauthenticated, and excluded from rate limiting — safe for load-balancer and Docker
healthchecks.

```json
{
    "status": "ok",
    "authEnabled": true,
    "concurrency": {
        "active": 0,
        "queued": 0,
        "max": 3
    },
    "maxFileSize": 10485760,
    "rateLimit": {
        "max": 60,
        "windowMs": 60000
    },
    "timeoutMs": 60000
}
```

### `POST /convert`

Multipart upload with a single field named `file` containing a `.docx` document.

- **Auth** (when enabled): `x-api-key: <key>` or `Authorization: Bearer <key>`, otherwise `401`.
- **Success**: `200` with `Content-Type: application/pdf` and
  `Content-Disposition: inline; filename="<name>.pdf"` (filename sanitized to `[^A-Za-z0-9._-]`).
- **Errors**:

| Status | Meaning                                                     |
|--------|-------------------------------------------------------------|
| `400`  | Upload exceeds `MAX_FILE_SIZE`                              |
| `401`  | Missing or invalid API key                                  |
| `412`  | Missing `file` field or unsupported file extension          |
| `415`  | File content is not a valid `.docx` (magic-byte check)      |
| `429`  | Rate limit exceeded (`Retry-After` + `RateLimit` headers)   |
| `500`  | Conversion failed                                           |

## SDK

The official client is [`@darcas/docmorph-sdk`](https://www.npmjs.com/package/@darcas/docmorph-sdk):
ESM + CJS, Node ≥ 20 and browsers, zero runtime dependencies.

```bash
npm install @darcas/docmorph-sdk
```

```ts
import {DocMorphClient} from '@darcas/docmorph-sdk';

const client = new DocMorphClient({
    baseUrl: 'http://localhost:8080',
    apiKey: process.env.DOCMORPH_API_KEY,
});

const {bytes} = await client.convert(docxBytes, {filename: 'document.docx'});
```

Options, error codes and the `convertFile` Node helper are documented in
[`sdk/README.md`](sdk/README.md).

## Local development

Requires Node.js `>= 22` (see `.nvmrc`).

```bash
npm install
npm run dev        # tsx watch, serves the API locally
npm run typecheck  # tsc --noEmit
npm run build && npm start  # compile src/ → dist/ and run
```

> Conversion itself needs `soffice` (`libreoffice-core` + `libreoffice-writer`), which exists only
> in the Docker image. Local `npm run dev` serves the routes, but `POST /convert` will fail with
> `CONVERSION_FAILED` outside Docker — verify inside the built image.

## Project structure

```text
src/
├── index.ts        # routes, auth, rate limiting, concurrency pool
├── convert.ts      # headless LibreOffice (soffice) wrapper
├── concurrency.ts  # semaphore bounding simultaneous conversions
└── logger.ts       # request-scoped key=value stdout/stderr logging
```

`sdk/` holds the published npm client (`@darcas/docmorph-sdk`).

Each conversion runs `soffice --headless --convert-to pdf` in an isolated temp directory with a
dedicated LibreOffice user profile per job, so concurrent conversions never interfere.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [Dario Casertano (DarCas)](https://casertano.name).
