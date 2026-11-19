/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

import type { DocMorphErrorCode, DocMorphErrorOptions } from './types.js'

/**
 * Error thrown by every DocMorph SDK operation.
 *
 * The `code` field is the stable discriminant; `status`, `details` and
 * `retryAfterMs` carry the HTTP context when the failure came from a response.
 *
 * @example
 * ```ts
 * try {
 *     await client.convert(docx, {filename: 'report.docx'})
 * } catch (error) {
 *     if (error instanceof DocMorphError && error.code === 'RATE_LIMITED') {
 *         await delay(error.retryAfterMs ?? 1000)
 *     }
 * }
 * ```
 */
export class DocMorphError extends Error {
    /** Machine-readable failure reason. */
    readonly code: DocMorphErrorCode

    /** HTTP status when the failure came from a response. */
    readonly status?: number

    /** Parsed error body, usually `{error: string}`. */
    readonly details?: unknown

    /** Delay advertised by a `Retry-After` header, in milliseconds. */
    readonly retryAfterMs?: number

    /**
     * @param message Human-readable description.
     * @param options Machine-readable code and optional HTTP context.
     */
    constructor(message: string, options: DocMorphErrorOptions) {
        super(message, options.cause === undefined ? undefined : {cause: options.cause})
        this.name = 'DocMorphError'
        this.code = options.code
        this.status = options.status
        this.details = options.details
        this.retryAfterMs = options.retryAfterMs
    }
}
