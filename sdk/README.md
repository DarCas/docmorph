# DocMorph SDK

[![npm version](https://img.shields.io/npm/v/@darcas/docmorph-sdk?style=for-the-badge)](https://www.npmjs.com/package/@darcas/docmorph-sdk)
![Node.js](https://img.shields.io/badge/node.js-%3E%3D20-5FA04E?logo=nodedotjs&logoColor=white&style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
[![SDK CI](https://github.com/DarCas/docmorph/actions/workflows/sdk.yml/badge.svg)](https://github.com/DarCas/docmorph/actions/workflows/sdk.yml)

Typed, isomorphic JavaScript client for the [DocMorph](../README.md) DOCX → PDF
API. Zero runtime dependencies, ESM + CJS, Node 20+ and browsers.

The package covers every route the service exposes: `POST /convert` and
`GET /health`. It adds client-side input validation, typed errors, timeouts,
cancellation and optional retries.

## Install

```bash
npm install @darcas/docmorph-sdk
```

## Quick start (Node)

```ts
import {DocMorphClient} from '@darcas/docmorph-sdk'
import {convertFile} from '@darcas/docmorph-sdk/node'
import {writeFile} from 'node:fs/promises'

const client = new DocMorphClient({
    baseUrl: 'https://docmorph.example.com',
    apiKey: process.env.DOCMORPH_API_KEY,
})

const result = await convertFile(client, 'report.docx')
await writeFile('report.pdf', result.bytes)
```

`convertFile` reads the document from disk and derives the multipart filename
from the path. Filesystem errors (`ENOENT`, `EACCES`, …) propagate unchanged;
conversion failures throw `DocMorphError`.

## Quick start (browser)

```ts
import {DocMorphClient} from '@darcas/docmorph-sdk'

const client = new DocMorphClient({
    baseUrl: 'https://docmorph.example.com',
    apiKey: 'public-demo-key',
})

const file = document.querySelector('input[type=file]').files[0]
const result = await client.convert(file)

const url = URL.createObjectURL(new Blob([result.bytes], {type: result.contentType}))
```

> **Browser security.** Any key bundled into a browser app is public. Use a
> backend proxy when the key must stay secret. The service allows all origins
> (`Access-Control-Allow-Origin: *`) but does not expose `Content-Disposition`
> or `Retry-After` to cross-origin scripts, so the SDK falls back to the input
> filename and to its own backoff delay.

## API

`health` and `convert` are own enumerable properties of each instance, so they
show up in inspection and can be destructured safely:

```ts
const {convert, health} = client
const healthPayload = await health()
const pdf = await convert(docxBytes, {filename: 'report.docx'})
```

### `new DocMorphClient(options)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `baseUrl` | `string` | required | Absolute `http`/`https` URL, optionally with a path prefix. |
| `apiKey` | `string` | — | Sent with every conversion request. Omit for open servers. |
| `authScheme` | `'x-api-key' \| 'bearer'` | `'x-api-key'` | Header used for the key. |
| `timeoutMs` | `number` | `120000` | Per-attempt timeout. |
| `retries` | `number` | `0` | Retries after the first attempt. |
| `retryDelayMs` | `number` | `500` | Base delay for exponential backoff. |
| `headers` | `Record<string, string>` | `{}` | Extra headers for every request. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation. |

Invalid configuration throws `DocMorphError` with code `INVALID_ARGUMENT`.

### `client.convert(input, options?)`

Converts one `.docx` document to PDF.

- `input`: `Blob` (including `File`), `ArrayBuffer` or `ArrayBufferView`
  (including Node `Buffer`).
- `options.filename`: required unless the input is a `File` or a `Blob` with a
  `name` property. Must end in `.docx`.
- `options.signal`: `AbortSignal` for cancellation.
- `options.timeoutMs`: overrides the client timeout for this call.
- `options.headers`: extra headers for this call; they win over client headers.

Returns:

```ts
interface ConversionResult {
    readonly bytes: Uint8Array
    readonly filename: string
    readonly contentType: string
}
```

The SDK validates the filename, rejects empty input, and verifies the response
`Content-Type` and `%PDF` magic before returning the bytes.

### `client.health(options?)`

Reads `GET /health`. The route is public and excluded from rate limiting. The
returned `concurrency` object is live semaphore state and can be used to detect
saturation before submitting work.

### `convertFile(client, path, options?)`

Available from `@darcas/docmorph-sdk/node`. Accepts a filesystem path or a
`file:` URL, reads the file and calls `client.convert`.

## Errors

Every SDK failure is a `DocMorphError`:

```ts
import {DocMorphError} from '@darcas/docmorph-sdk'

try {
    await client.convert(docx, {filename: 'report.docx'})
} catch (error) {
    if (error instanceof DocMorphError) {
        console.error(error.code, error.status, error.retryAfterMs)
    }
}
```

| `code` | Cause |
| --- | --- |
| `INVALID_ARGUMENT` | Invalid client options, input or filename. |
| `INVALID_FILE` | `412`: missing file or filename not ending in `.docx`. |
| `INVALID_CONTENT` | `415`: content is not an OOXML/ZIP document. |
| `FILE_TOO_LARGE` | `400`: upload exceeds the server size limit. |
| `UNAUTHORIZED` | `401`: missing or invalid API key. |
| `RATE_LIMITED` | `429`: per-IP limit exceeded. |
| `CONVERSION_FAILED` | `500`: LibreOffice failed or timed out. |
| `NOT_FOUND` | `404`: usually a wrong `baseUrl`. |
| `HTTP_ERROR` | Any other non-2xx response. |
| `NETWORK_ERROR` | DNS, connection or TLS failure. |
| `TIMEOUT` | The per-attempt timeout elapsed. |
| `ABORTED` | The provided `AbortSignal` was aborted. |
| `INVALID_RESPONSE` | Body is not JSON, not a PDF, or has an unexpected shape. |

`details` holds the parsed error body (usually `{error: string}`), and
`Error.cause` preserves the original exception.

## Retries and timeouts

Retries are opt-in: the default is `0`. When enabled, only `429`, `502`, `503`,
`504` and network failures are retried. Input errors (`400`, `401`, `412`,
`415`, `500`) are never retried.

Backoff is exponential with up to 25% jitter. A `Retry-After` header takes
precedence. Retrying a conversion runs the conversion again on the server, so
enable retries deliberately when conversions are expensive.

The default timeout is 120 seconds per attempt, which covers the service's
default 60-second LibreOffice timeout plus queueing time. Timeouts and
user-initiated aborts are not retried.

## Compatibility

- Node.js **20+**.
- Browsers with `fetch`, `FormData`, `Blob` and `AbortController`.
- Deno and Bun are expected to work through the ESM build but are not covered
  by CI.
- Dual ESM/CJS package with bundled TypeScript declarations.

Not supported, because the service does not expose them: upload progress, job
polling and server-side conversion history.

## License

MIT. See [LICENSE](./LICENSE).

---

Made with ❤️ by [Dario Casertano (DarCas)](https://casertano.name).
