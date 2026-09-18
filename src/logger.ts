/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Minimal request-scoped structured logger.
 *
 * Emits single-line `key=value` records to stdout/stderr with no external
 * dependencies. Every line carries the owning request id so concurrent
 * conversions remain correlatable in aggregated logs.
 *
 * @example
 * ```ts
 * const logger = new Logger(randomUUID())
 * logger.info('convert done', { filename: 'report.pdf', sizeBytes: 38380 })
 * // [2026-09-18T13:35:54.364Z] INFO  convert done requestId="..." filename="report.pdf" sizeBytes=38380
 * ```
 */

/** Severity levels supported by the logger. */
type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

/** Column width used to pad the level label for aligned output. */
const PAD = 5

/**
 * Returns the current timestamp as an ISO-8601 string.
 *
 * @returns The current time, e.g. `2026-09-18T13:35:54.364Z`.
 */
function ts(): string {
    return new Date().toISOString()
}

/**
 * Renders a single log line with timestamp, padded level, message and fields.
 *
 * @param level - Severity label of the record.
 * @param msg - Short human-readable event name.
 * @param fields - Structured key/value context appended to the line.
 * @returns The formatted log line (without trailing newline).
 */
function format(level: Level, msg: string, fields: Record<string, unknown>): string {
    const kv = Object.entries(fields)
        .map(([key, value]) => `${key}=${formatValue(value)}`)
        .join(' ')

    const line = `[${ts()}] ${level.padEnd(PAD, ' ')} ${msg}`

    return kv ? `${line} ${kv}` : line
}

/**
 * Renders a single field value for log output.
 *
 * Strings and errors are double-quoted with embedded quotes escaped; every
 * other type falls back to its `String()` representation.
 *
 * @param value - The value to render.
 * @returns The log-safe string representation.
 */
function formatValue(value: unknown): string {
    if (typeof value === 'string') {
        return `"${value.replace(/"/g, '\\"')}"`
    }

    if (value instanceof Error) {
        return `"${value.message.replace(/"/g, '\\"')}"`
    }

    return String(value)
}

/**
 * Request-scoped logger. One instance is created per incoming HTTP request
 * and attached to `req.logger` by the Express middleware in `index.ts`.
 */
export class Logger {
    /** Unique id of the owning request, included in every emitted line. */
    readonly requestId: string

    /**
     * Creates a logger bound to a request.
     *
     * @param requestId - Unique request identifier (typically a UUID).
     */
    constructor(requestId: string) {
        this.requestId = requestId
    }

    /**
     * Emits a debug line to stdout.
     *
     * @param msg - Short event name.
     * @param fields - Additional structured context.
     */
    debug(msg: string, fields: Record<string, unknown> = {}): void {
        console.log(format('DEBUG', msg, {requestId: this.requestId, ...fields}))
    }

    /**
     * Emits an informational line to stdout.
     *
     * @param msg - Short event name.
     * @param fields - Additional structured context.
     */
    info(msg: string, fields: Record<string, unknown> = {}): void {
        console.log(format('INFO', msg, {requestId: this.requestId, ...fields}))
    }

    /**
     * Emits a warning line to stderr.
     *
     * @param msg - Short event name.
     * @param fields - Additional structured context.
     */
    warn(msg: string, fields: Record<string, unknown> = {}): void {
        console.warn(format('WARN', msg, {requestId: this.requestId, ...fields}))
    }

    /**
     * Emits an error line to stderr.
     *
     * @param msg - Short event name.
     * @param fields - Additional structured context.
     */
    error(msg: string, fields: Record<string, unknown> = {}): void {
        console.error(format('ERROR', msg, {requestId: this.requestId, ...fields}))
    }
}
