/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

import { DocMorphError } from './errors.js'
import type {
    ConvertOptions,
    ConversionResult,
    DocMorphAuthScheme,
    DocMorphClientOptions,
    DocMorphErrorCode,
    DocMorphInput,
    HealthResponse,
    RequestOptions,
} from './types.js'

const DOCX_SUFFIX = '.docx'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PDF_MIME = 'application/pdf'
const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_RETRY_DELAY_MS = 500
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])

interface AttemptSuccess<T> {
    readonly ok: true
    readonly value: T
}

interface AttemptFailure {
    readonly ok: false
    readonly error: DocMorphError
    readonly retryable: boolean
}

type AttemptResult<T> = AttemptSuccess<T> | AttemptFailure

interface AbortState {
    aborted: boolean
    timedOut: boolean
}

/**
 * Isomorphic client for the DocMorph HTTP API.
 *
 * Only web-standard APIs are used (`fetch`, `FormData`, `Blob`,
 * `AbortController`), so the same instance works in Node 20+, browsers, Deno
 * and Bun. Node-specific helpers live in `@darcas/docmorph-sdk/node`.
 *
 * @example
 * ```ts
 * const client = new DocMorphClient({
 *     baseUrl: 'https://docmorph.example.com',
 *     apiKey: process.env.DOCMORPH_API_KEY,
 * })
 *
 * const result = await client.convert(docxBytes, {filename: 'report.docx'})
 * await writeFile('report.pdf', result.bytes)
 * ```
 */
export class DocMorphClient {
    readonly #baseUrl: string
    readonly #apiKey: string | undefined
    readonly #authScheme: DocMorphAuthScheme
    readonly #timeoutMs: number
    readonly #retries: number
    readonly #retryDelayMs: number
    readonly #headers: Readonly<Record<string, string>>
    readonly #fetch: typeof fetch

    /**
     * @param options Endpoint, credentials and transport configuration.
     * @throws {DocMorphError} `INVALID_ARGUMENT` when the configuration is invalid.
     */
    constructor(options: DocMorphClientOptions) {
        if (!isRecord(options)) {
            throw invalidArgument('options must be an object')
        }

        this.#baseUrl = normalizeBaseUrl(options.baseUrl)
        this.#apiKey = optionalApiKey(options.apiKey)
        this.#authScheme = validateAuthScheme(options.authScheme)
        this.#timeoutMs = validateDuration(options.timeoutMs, 'timeoutMs', DEFAULT_TIMEOUT_MS)
        this.#retries = validateRetries(options.retries)
        this.#retryDelayMs = validateDuration(
            options.retryDelayMs,
            'retryDelayMs',
            DEFAULT_RETRY_DELAY_MS,
            true,
        )
        this.#headers = validateHeaders(options.headers, 'headers')

        const fetchImpl = options.fetch ?? globalThis.fetch
        if (typeof fetchImpl !== 'function') {
            throw invalidArgument('fetch is not available; pass options.fetch')
        }
        this.#fetch = fetchImpl
    }

    /**
     * Reads the service health and live concurrency state.
     *
     * `GET /health` is public and excluded from rate limiting.
     *
     * @param options Per-call timeout, abort signal and headers.
     * @returns Typed health payload.
     * @throws {DocMorphError} On network, timeout, HTTP or payload-shape failures.
     */
    readonly health = async (options: RequestOptions = {}): Promise<HealthResponse> => {
        validateRequestOptions(options)

        return this.#request(
            'health',
            {method: 'GET', headers: {accept: 'application/json'}},
            options,
            readHealth,
        )
    }

    /**
     * Converts one `.docx` document to PDF.
     *
     * The filename is required unless the input is a `File` (or any `Blob`
     * with a `name` property), in which case it is derived automatically.
     *
     * @param input Document bytes or `File`/`Blob`.
     * @param options Filename, timeout, abort signal and headers.
     * @returns PDF bytes plus the filename advertised by the service.
     * @throws {DocMorphError} On invalid input, HTTP, network or payload failures.
     */
    readonly convert = async (
        input: DocMorphInput,
        options: ConvertOptions = {},
    ): Promise<ConversionResult> => {
        validateRequestOptions(options)

        const filename = resolveDocxFilename(input, options.filename)
        const blob = toBlob(input)
        if (blob.size === 0) {
            throw invalidArgument('input document is empty')
        }

        let form: FormData
        try {
            form = new FormData()
            form.append('file', blob, filename)
        } catch (error) {
            throw new DocMorphError('Unable to build the multipart body', {
                code: 'INVALID_ARGUMENT',
                cause: error,
            })
        }

        return this.#request(
            'convert',
            {method: 'POST', body: form, headers: {accept: PDF_MIME}},
            options,
            async (response) => {
                const contentType = (response.headers.get('content-type') ?? '').trim()
                if (!contentType.toLowerCase().startsWith(PDF_MIME)) {
                    throw new DocMorphError('Expected an application/pdf response', {
                        code: 'INVALID_RESPONSE',
                        status: response.status,
                        details: {contentType},
                    })
                }

                const bytes = new Uint8Array(await response.arrayBuffer())
                if (!hasPdfMagic(bytes)) {
                    throw new DocMorphError('Response body is not a PDF document', {
                        code: 'INVALID_RESPONSE',
                        status: response.status,
                    })
                }

                return {
                    bytes,
                    filename:
                        parseContentDispositionFilename(
                            response.headers.get('content-disposition'),
                        ) ?? pdfFilename(filename),
                    contentType,
                }
            },
        )
    }

    async #request<T>(
        path: string,
        init: RequestInit,
        options: RequestOptions,
        read: (response: Response) => Promise<T>,
    ): Promise<T> {
        const url = new URL(path, this.#baseUrl).href

        for (let attempt = 0; ; attempt += 1) {
            const result = await this.#attempt(url, init, options, read)
            if (result.ok) {
                return result.value
            }
            if (!result.retryable || attempt >= this.#retries) {
                throw result.error
            }

            const delayMs = result.error.retryAfterMs ?? this.#backoffDelay(attempt)
            await sleep(delayMs, options.signal)
        }
    }

    async #attempt<T>(
        url: string,
        init: RequestInit,
        options: RequestOptions,
        read: (response: Response) => Promise<T>,
    ): Promise<AttemptResult<T>> {
        if (options.signal?.aborted) {
            return {ok: false, error: abortedError(), retryable: false}
        }

        const timeoutMs = options.timeoutMs ?? this.#timeoutMs
        const state: AbortState = {aborted: false, timedOut: false}
        const controller = new AbortController()
        const onAbort = () => {
            state.aborted = true
            controller.abort()
        }

        options.signal?.addEventListener('abort', onAbort, {once: true})
        const timer = setTimeout(() => {
            state.timedOut = true
            controller.abort()
        }, timeoutMs)

        try {
            let response: Response
            try {
                response = await this.#fetch(url, {
                    ...init,
                    headers: this.#buildHeaders(init.headers, options.headers),
                    signal: controller.signal,
                })
            } catch (error) {
                return this.#networkFailure(state, timeoutMs, error)
            }

            if (!response.ok) {
                let httpError: DocMorphError
                try {
                    httpError = await readHttpError(response)
                } catch (error) {
                    return this.#readFailure(state, timeoutMs, response.status, error, 'error')
                }

                return {
                    ok: false,
                    error: httpError,
                    retryable: RETRYABLE_STATUSES.has(response.status),
                }
            }

            try {
                return {ok: true, value: await read(response)}
            } catch (error) {
                if (error instanceof DocMorphError) {
                    return {ok: false, error, retryable: false}
                }
                return this.#readFailure(state, timeoutMs, response.status, error, 'body')
            }
        } finally {
            clearTimeout(timer)
            options.signal?.removeEventListener('abort', onAbort)
        }
    }

    #networkFailure(
        state: AbortState,
        timeoutMs: number,
        cause: unknown,
    ): AttemptFailure {
        if (state.aborted) {
            return {ok: false, error: abortedError(cause), retryable: false}
        }
        if (state.timedOut) {
            return {ok: false, error: timeoutError(timeoutMs, cause), retryable: false}
        }

        return {
            ok: false,
            error: new DocMorphError('Network request failed', {
                code: 'NETWORK_ERROR',
                cause,
            }),
            retryable: true,
        }
    }

    #readFailure(
        state: AbortState,
        timeoutMs: number,
        status: number,
        cause: unknown,
        part: 'body' | 'error',
    ): AttemptFailure {
        if (state.aborted) {
            return {ok: false, error: abortedError(cause), retryable: false}
        }
        if (state.timedOut) {
            return {ok: false, error: timeoutError(timeoutMs, cause), retryable: false}
        }

        return {
            ok: false,
            error: new DocMorphError(
                part === 'error'
                    ? 'Unable to read the error response'
                    : 'Unable to read the response body',
                {code: 'INVALID_RESPONSE', status, cause},
            ),
            retryable: false,
        }
    }

    #buildHeaders(
        initHeaders: HeadersInit | undefined,
        callHeaders: Record<string, string> | undefined,
    ): Headers {
        const headers = new Headers(initHeaders)

        if (this.#apiKey !== undefined) {
            if (this.#authScheme === 'bearer') {
                headers.set('authorization', `Bearer ${this.#apiKey}`)
            } else {
                headers.set('x-api-key', this.#apiKey)
            }
        }

        for (const [name, value] of Object.entries(this.#headers)) {
            headers.set(name, value)
        }
        for (const [name, value] of Object.entries(callHeaders ?? {})) {
            headers.set(name, value)
        }

        return headers
    }

    #backoffDelay(attempt: number): number {
        const base = this.#retryDelayMs * 2 ** attempt
        return base + Math.floor(Math.random() * base * 0.25)
    }
}

async function readHealth(response: Response): Promise<HealthResponse> {
    let payload: unknown
    try {
        payload = await response.json()
    } catch (error) {
        throw new DocMorphError('Response is not valid JSON', {
            code: 'INVALID_RESPONSE',
            status: response.status,
            cause: error,
        })
    }

    if (!isHealthResponse(payload)) {
        throw new DocMorphError('Unexpected health response shape', {
            code: 'INVALID_RESPONSE',
            status: response.status,
            details: payload,
        })
    }

    return payload
}

async function readHttpError(response: Response): Promise<DocMorphError> {
    const text = await response.text()
    let details: unknown

    if (text.length > 0) {
        try {
            details = JSON.parse(text)
        } catch {
            details = text
        }
    }

    const message = extractErrorMessage(details, response.status)

    return new DocMorphError(message, {
        code: statusCode(response.status, message),
        status: response.status,
        details,
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
    })
}

function statusCode(status: number, message: string): DocMorphErrorCode {
    switch (status) {
        case 400:
            return /too large/i.test(message) ? 'FILE_TOO_LARGE' : 'HTTP_ERROR'
        case 401:
            return 'UNAUTHORIZED'
        case 404:
            return 'NOT_FOUND'
        case 412:
            return 'INVALID_FILE'
        case 415:
            return 'INVALID_CONTENT'
        case 429:
            return 'RATE_LIMITED'
        case 500:
            return 'CONVERSION_FAILED'
        default:
            return 'HTTP_ERROR'
    }
}

function extractErrorMessage(details: unknown, status: number): string {
    if (isRecord(details) && typeof details.error === 'string' && details.error.length > 0) {
        return details.error
    }
    if (typeof details === 'string' && details.trim().length > 0) {
        return details.trim().slice(0, 200)
    }
    return `DocMorph request failed with status ${status}`
}

function parseRetryAfter(value: string | null): number | undefined {
    if (value === null || value.trim().length === 0) {
        return undefined
    }

    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.round(seconds * 1000)
    }

    const date = Date.parse(value)
    if (Number.isNaN(date)) {
        return undefined
    }
    return Math.max(0, date - Date.now())
}

function parseContentDispositionFilename(header: string | null): string | undefined {
    if (header === null) {
        return undefined
    }

    const quoted = /filename="([^"]*)"/i.exec(header)
    const bare = /filename=([^;]+)/i.exec(header)
    const value = (quoted?.[1] ?? bare?.[1] ?? '').trim()
    const base = basename(value).replace(/[\u0000-\u001f\u007f]/g, '')

    return base.length > 0 ? base : undefined
}

function pdfFilename(filename: string): string {
    return `${filename.slice(0, -DOCX_SUFFIX.length)}.pdf`
}

function resolveDocxFilename(input: DocMorphInput, explicit: string | undefined): string {
    if (explicit !== undefined && typeof explicit !== 'string') {
        throw invalidArgument('filename must be a string')
    }

    const candidate = explicit ?? fileLikeName(input)
    if (candidate === undefined || candidate.length === 0) {
        throw invalidArgument('filename is required when the input is not a File')
    }
    if (/[\r\n\u0000]/.test(candidate)) {
        throw invalidArgument('filename must not contain control characters')
    }

    const base = basename(candidate)
    if (!base.toLowerCase().endsWith(DOCX_SUFFIX) || base.length <= DOCX_SUFFIX.length) {
        throw invalidArgument('filename must end with .docx')
    }

    return base
}

function toBlob(input: DocMorphInput): Blob {
    if (isBlob(input)) {
        return input
    }
    if (input instanceof ArrayBuffer) {
        return new Blob([input], {type: DOCX_MIME})
    }
    if (ArrayBuffer.isView(input)) {
        const view = new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
        const copy = new Uint8Array(view.byteLength)
        copy.set(view)
        return new Blob([copy], {type: DOCX_MIME})
    }

    throw invalidArgument('input must be a Blob, ArrayBuffer or ArrayBufferView')
}

function fileLikeName(input: DocMorphInput): string | undefined {
    if (!isBlob(input)) {
        return undefined
    }

    const name = (input as Blob & {name?: unknown}).name
    return typeof name === 'string' && name.length > 0 ? name : undefined
}

function isBlob(value: unknown): value is Blob {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const candidate = value as Blob
    return (
        typeof candidate.arrayBuffer === 'function' &&
        typeof candidate.size === 'number' &&
        typeof candidate.type === 'string'
    )
}

function hasPdfMagic(bytes: Uint8Array): boolean {
    return (
        bytes.byteLength >= 4 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46
    )
}

function isHealthResponse(value: unknown): value is HealthResponse {
    if (!isRecord(value)) {
        return false
    }

    return (
        typeof value.status === 'string' &&
        typeof value.authEnabled === 'boolean' &&
        typeof value.maxFileSize === 'number' &&
        typeof value.timeoutMs === 'number' &&
        isRecord(value.concurrency) &&
        isNumber(value.concurrency.active) &&
        isNumber(value.concurrency.queued) &&
        isNumber(value.concurrency.max) &&
        isRecord(value.rateLimit) &&
        isNumber(value.rateLimit.max) &&
        isNumber(value.rateLimit.windowMs)
    )
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

function normalizeBaseUrl(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw invalidArgument('baseUrl is required')
    }

    let url: URL
    try {
        url = new URL(value)
    } catch (error) {
        throw new DocMorphError('baseUrl must be an absolute URL', {
            code: 'INVALID_ARGUMENT',
            cause: error,
        })
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw invalidArgument('baseUrl must use http or https')
    }
    if (url.search.length > 0 || url.hash.length > 0) {
        throw invalidArgument('baseUrl must not contain a query string or fragment')
    }

    return url.href.endsWith('/') ? url.href : `${url.href}/`
}

function optionalApiKey(value: unknown): string | undefined {
    if (value === undefined) {
        return undefined
    }
    if (typeof value !== 'string' || value.length === 0) {
        throw invalidArgument('apiKey must be a non-empty string')
    }
    return value
}

function validateAuthScheme(value: unknown): DocMorphAuthScheme {
    if (value === undefined) {
        return 'x-api-key'
    }
    if (value === 'x-api-key' || value === 'bearer') {
        return value
    }
    throw invalidArgument("authScheme must be 'x-api-key' or 'bearer'")
}

function validateDuration(
    value: unknown,
    name: string,
    fallback: number,
    allowZero = false,
): number {
    if (value === undefined) {
        return fallback
    }
    if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        (allowZero ? value < 0 : value <= 0)
    ) {
        throw invalidArgument(`${name} must be a ${allowZero ? 'non-negative' : 'positive'} number`)
    }
    return value
}

function validateRetries(value: unknown): number {
    if (value === undefined) {
        return 0
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw invalidArgument('retries must be a non-negative integer')
    }
    return value
}

function validateHeaders(
    value: unknown,
    name: string,
): Readonly<Record<string, string>> {
    if (value === undefined) {
        return Object.freeze({})
    }
    if (!isRecord(value)) {
        throw invalidArgument(`${name} must be an object`)
    }

    const headers: Record<string, string> = {}
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry !== 'string') {
            throw invalidArgument(`${name}.${key} must be a string`)
        }
        headers[key] = entry
    }

    return Object.freeze(headers)
}

function validateRequestOptions(options: RequestOptions): void {
    if (!isRecord(options)) {
        throw invalidArgument('request options must be an object')
    }
    if (options.signal !== undefined && !isAbortSignal(options.signal)) {
        throw invalidArgument('signal must be an AbortSignal')
    }
    if (options.timeoutMs !== undefined) {
        validateDuration(options.timeoutMs, 'timeoutMs', DEFAULT_TIMEOUT_MS)
    }
    if (options.headers !== undefined) {
        validateHeaders(options.headers, 'headers')
    }
}

function isAbortSignal(value: unknown): value is AbortSignal {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const signal = value as AbortSignal
    return (
        typeof signal.aborted === 'boolean' &&
        typeof signal.addEventListener === 'function' &&
        typeof signal.removeEventListener === 'function'
    )
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
        return Promise.reject(abortedError())
    }
    if (ms <= 0) {
        return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined

        const onAbort = () => {
            if (timer !== undefined) {
                clearTimeout(timer)
            }
            reject(abortedError())
        }

        timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort)
            resolve()
        }, ms)
        signal?.addEventListener('abort', onAbort, {once: true})
    })
}

function basename(value: string): string {
    const normalized = value.replace(/\\/g, '/')
    const index = normalized.lastIndexOf('/')
    return index === -1 ? normalized : normalized.slice(index + 1)
}

function invalidArgument(message: string): DocMorphError {
    return new DocMorphError(message, {code: 'INVALID_ARGUMENT'})
}

function abortedError(cause?: unknown): DocMorphError {
    return new DocMorphError('Request aborted', {code: 'ABORTED', cause})
}

function timeoutError(timeoutMs: number, cause?: unknown): DocMorphError {
    return new DocMorphError(`Request timed out after ${timeoutMs} ms`, {
        code: 'TIMEOUT',
        cause,
    })
}
