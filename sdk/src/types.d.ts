/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Public type surface of `@darcas/docmorph-sdk`.
 *
 * Every public type alias, union and interface lives in this file. Runtime
 * values (the client and the error class) live in their own `.ts` modules so
 * TypeScript can check the implementation against these declarations.
 */

/**
 * Document accepted by {@link DocMorphClient.convert}.
 *
 * `Blob` includes browser `File` objects and Node's global `File`, which lets
 * the client derive the uploaded filename automatically.
 */
export type DocMorphInput = Blob | ArrayBuffer | ArrayBufferView

/**
 * Authentication header used when an API key is configured.
 *
 * `x-api-key` is the server's preferred header; `bearer` is accepted as an
 * alternative for clients that standardise on `Authorization`.
 */
export type DocMorphAuthScheme = 'x-api-key' | 'bearer'

/**
 * Options accepted by {@link DocMorphClient}.
 */
export interface DocMorphClientOptions {
    /** Base URL of the DocMorph service, for example `https://docmorph.example.com`. */
    baseUrl: string
    /**
     * API key sent with every conversion request.
     *
     * Omit it when the server runs without `API_KEYS` (open access).
     */
    apiKey?: string
    /** Header used to send {@link apiKey}. Defaults to `x-api-key`. */
    authScheme?: DocMorphAuthScheme
    /**
     * Per-attempt timeout in milliseconds. Defaults to `120000`.
     *
     * The service waits up to `CONVERT_TIMEOUT_MS` (60s by default) for
     * LibreOffice, so the client default also covers queueing time.
     */
    timeoutMs?: number
    /**
     * Number of retries after the first attempt. Defaults to `0`.
     *
     * Only `429`, `502`, `503`, `504` and network failures are retried.
     * Input errors (`400`, `401`, `412`, `415`, `500`) are never retried.
     */
    retries?: number
    /** Base delay for exponential backoff in milliseconds. Defaults to `500`. */
    retryDelayMs?: number
    /** Extra headers merged into every request. Per-call headers win. */
    headers?: Record<string, string>
    /**
     * Custom `fetch` implementation. Defaults to `globalThis.fetch`.
     *
     * Useful for tests, instrumentation or runtimes that expose fetch on a
     * different global.
     */
    fetch?: typeof fetch
}

/**
 * Options shared by every request method.
 */
export interface RequestOptions {
    /** Cancels the request. A retry already in progress is cancelled too. */
    signal?: AbortSignal
    /** Overrides the client-level timeout for this call. */
    timeoutMs?: number
    /** Extra headers merged into this request. They win over client headers. */
    headers?: Record<string, string>
}

/**
 * Options accepted by {@link DocMorphClient.convert}.
 */
export interface ConvertOptions extends RequestOptions {
    /**
     * Filename sent in the multipart body. Must end in `.docx`.
     *
     * Required for `Blob`, `ArrayBuffer` and typed-array inputs. Optional for
     * `File` inputs, where the SDK falls back to `File.name`.
     */
    filename?: string
}

/**
 * Successful conversion returned by {@link DocMorphClient.convert}.
 */
export interface ConversionResult {
    /** Raw PDF bytes. */
    readonly bytes: Uint8Array
    /** PDF filename advertised by the service, or derived from the input name. */
    readonly filename: string
    /** Response media type, normally `application/pdf`. */
    readonly contentType: string
}

/**
 * Payload returned by `GET /health`.
 *
 * `concurrency` is read live from the service semaphore, so it can be used to
 * detect saturation before submitting a conversion.
 */
export interface HealthResponse {
    /** Service status, currently always `ok`. */
    readonly status: string
    /** Whether the service requires an API key. */
    readonly authEnabled: boolean
    /** Live conversion pool state. */
    readonly concurrency: {
        readonly active: number
        readonly queued: number
        readonly max: number
    }
    /** Maximum accepted upload size in bytes. */
    readonly maxFileSize: number
    /** Per-IP rate limit configuration. */
    readonly rateLimit: {
        readonly max: number
        readonly windowMs: number
    }
    /** LibreOffice conversion timeout in milliseconds. */
    readonly timeoutMs: number
}

/**
 * Discriminant carried by every {@link DocMorphError}.
 */
export type DocMorphErrorCode =
    | 'INVALID_ARGUMENT'
    | 'NETWORK_ERROR'
    | 'TIMEOUT'
    | 'ABORTED'
    | 'INVALID_RESPONSE'
    | 'UNAUTHORIZED'
    | 'INVALID_FILE'
    | 'INVALID_CONTENT'
    | 'FILE_TOO_LARGE'
    | 'RATE_LIMITED'
    | 'CONVERSION_FAILED'
    | 'NOT_FOUND'
    | 'HTTP_ERROR'

/**
 * Options accepted by the {@link DocMorphError} constructor.
 */
export interface DocMorphErrorOptions {
    /** Machine-readable failure reason. */
    code: DocMorphErrorCode
    /** HTTP status when the failure came from a response. */
    status?: number
    /** Parsed error body, usually `{error: string}`. */
    details?: unknown
    /** Delay advertised by a `Retry-After` header, in milliseconds. */
    retryAfterMs?: number
    /** Original error, preserved through `Error.cause`. */
    cause?: unknown
}
