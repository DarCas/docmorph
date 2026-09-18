/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * DocMorph HTTP entry point: DOCX-to-PDF conversion microservice.
 *
 * Exposes `GET /health` (public load-balancer probe), `GET /robots.txt`
 * (public crawler disallow), `POST /convert` (authenticated multipart
 * upload returning `application/pdf`) and a silent JSON `404` for anything
 * else. Cross-cutting concerns, in middleware order: request-scoped logging,
 * per-IP rate limiting, API-key auth, and CORS preflight handling.
 */

import express, { type NextFunction, type Request, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import clc from 'cli-color'
import multer from 'multer'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { createRequire } from 'node:module'
import { env, stdout } from 'node:process'
import { Semaphore } from './concurrency.js'
import {
    convertDocxToPdf,
    ConversionError,
    isSupportedDocument,
    sanitizeBaseName,
} from './convert.js'
import { Logger } from './logger.js'

/** HTTP listen port. Defaults to 8080. */
const PORT = Number(env.PORT ?? 8080)

/** Maximum accepted upload size in bytes. Defaults to 10 MiB. */
const MAX_FILE_SIZE = Number(env.MAX_FILE_SIZE ?? 10 * 1024 * 1024)

/** Hard timeout in milliseconds for a single LibreOffice conversion. */
const CONVERT_TIMEOUT_MS = Number(env.CONVERT_TIMEOUT_MS ?? 60_000)

/** Maximum number of simultaneous conversions; bounds LibreOffice load. */
const MAX_CONCURRENT = Number(env.MAX_CONCURRENT ?? 3)

/** Length of the rate-limit fixed window in milliseconds. */
const RATE_LIMIT_WINDOW_MS = Number(env.RATE_LIMIT_WINDOW_MS ?? 60_000)

/** Maximum requests per window per client IP (public paths excluded). */
const RATE_LIMIT_MAX = Number(env.RATE_LIMIT_MAX ?? 60)

/**
 * Configured API keys parsed from the comma-separated `API_KEYS` variable.
 * Empty or unset means the service runs open (a startup warning applies).
 */
const API_KEYS = new Set(
    ( env.API_KEYS ?? '' )
        .split(',')
        .map(key => key.trim())
        .filter(key => key.length > 0),
)

/** Whether authentication is enforced (true when at least one key exists). */
const AUTH_ENABLED = API_KEYS.size > 0

/**
 * Application version read from `package.json` for the startup banner.
 * Resolves from the project root in both dev (`src/`) and compiled (`dist/`)
 * layouts; falls back to `"unknown"` when unreadable.
 */
let VERSION = 'unknown'

try {
    VERSION = ( createRequire(import.meta.url)('../package.json') as {
        version?: string
    } ).version ?? 'unknown'
} catch {
    VERSION = 'unknown'
}

/**
 * Whether the startup banner may use ANSI colors. Enabled only on interactive
 * terminals (`stdout` is a TTY, `NO_COLOR` unset, sane `TERM`) so Docker and
 * piped logs stay plain and grep-friendly.
 */
const USE_COLORS = Boolean(stdout.isTTY) && env.NO_COLOR == null && env.TERM !== 'dumb'

/**
 * Applies a `cli-color` style when colors are enabled, otherwise returns the
 * text untouched.
 *
 * @param text - Text to style.
 * @param style - `cli-color` formatter such as `clc.bold.cyan`.
 * @returns Styled text on interactive CLIs, plain text everywhere else.
 */
function paint(text: string, style: (msg: string) => string): string {
    return USE_COLORS ? style(text) : text
}

/**
 * Formats a millisecond duration for human consumption in the startup banner
 * (`60000` → `"60s"`, `500` → `"500ms"`).
 *
 * @param ms - Duration in milliseconds.
 * @returns Compact human-readable duration.
 */
function formatDuration(ms: number): string {
    return ms % 1000 === 0 ? `${ms / 1000}s` : `${ms}ms`
}

/**
 * Hashes an API key with SHA-256 so comparisons never handle raw secrets
 * beyond the initial extraction step.
 *
 * @param key - Raw API key as provided by the client or configured on the server.
 * @returns The SHA-256 digest of the key.
 */
function hashKey(key: string): Buffer {
    return createHash('sha256')
        .update(key)
        .digest()
}

/**
 * Extracts the client-provided API key from `x-api-key` or, as a fallback,
 * from an `Authorization: Bearer <key>` header.
 *
 * @param req - Incoming Express request.
 * @returns The trimmed key, or `undefined` when neither header is present.
 */
function getProvidedKey(req: Request): string | undefined {
    const headerKey = req.header('x-api-key')
        ?.trim()

    if (headerKey) {
        return headerKey
    }

    const authorization = req.header('authorization')

    if (authorization) {
        const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())

        if (match) {
            return match[ 1 ].trim()
        }
    }

    return undefined
}

/**
 * Verifies a provided key against the configured set using SHA-256 digests
 * compared with {@link timingSafeEqual} to avoid timing side channels.
 *
 * @param provided - Key extracted from the request, if any.
 * @returns `true` when the key matches a configured entry.
 */
function isAuthorized(provided: string | undefined): boolean {
    if (!provided) {
        return false
    }

    const providedHash = hashKey(provided)

    for (const key of API_KEYS) {
        const expectedHash = hashKey(key)

        if (providedHash.length === expectedHash.length && timingSafeEqual(providedHash, expectedHash)) {
            return true
        }
    }

    return false
}

/** Conversion pool bounding simultaneous LibreOffice invocations. */
const pool = new Semaphore(MAX_CONCURRENT)

/**
 * Reports whether a request targets a public path exempt from both rate
 * limiting and authentication: `GET /health`, `GET /robots.txt`, and any
 * `OPTIONS` preflight (browsers must reach preflight without credentials).
 *
 * @param req - Incoming Express request.
 * @returns `true` when the request bypasses auth and rate limiting.
 */
function isPublicPath(req: Request): boolean {
    if (req.method === 'OPTIONS') {
        return true
    }

    return req.method === 'GET' &&
        ( req.path === '/health' || req.path === '/robots.txt' )
}

/**
 * Per-IP fixed-window rate limiter. Public paths are skipped; over-limit
 * requests receive `429 { error: 'Too many requests' }` plus the standard
 * `RateLimit-*` headers set by the library.
 */
const limiter = rateLimit({
    handler: (req, res) => {
        ( req.logger as Logger ).warn('Rate limited', {path: req.path})

        res.status(429)
            .json({error: 'Too many requests'})
    },
    legacyHeaders: false,
    limit: RATE_LIMIT_MAX,
    skip: isPublicPath,
    standardHeaders: 'draft-8',
    windowMs: RATE_LIMIT_WINDOW_MS,
})

/**
 * In-memory upload handler: single `file` field capped at `MAX_FILE_SIZE`.
 * Memory storage keeps job temp dirs (managed by `convert.ts`) as the only
 * on-disk footprint.
 */
const upload = multer({
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
    },
    storage: multer.memoryStorage(),
})

const app = express()

app.disable('x-powered-by')
// Single Apache hop (ProxyPass localhost:3001): trust the closest proxy only.
// `true` would trust every hop and re-trigger ERR_ERL_PERMISSIVE_TRUST_PROXY.
app.set('trust proxy', 1)

/**
 * Augments `Express.Request` with the request-scoped logger attached by the
 * logging middleware below.
 */
declare global {
    namespace Express {
        interface Request {
            /** Request-scoped logger; always set before auth/rate-limit code runs. */
            logger?: Logger
        }
    }
}

/**
 * Logging middleware: attaches a fresh {@link Logger} with a random UUID to
 * every request. Must stay first so downstream handlers can always log.
 */
app.use((req, _res, next) => {
    req.logger = new Logger(randomUUID())
    next()
})

/** Applies per-IP rate limiting to all non-public paths. */
app.use(limiter)

/**
 * API-key authentication middleware.
 *
 * Public paths pass through untouched. Unknown (unmapped) paths also pass
 * through so the catch-all below answers a silent `404` instead of leaking
 * a `401` to scanners. Only `POST /convert` is challenged; failures are
 * logged and answered with `401 { error: 'Unauthorized' }`.
 */
app.use((req: Request, res: Response, next: NextFunction): void => {
    if (!AUTH_ENABLED || isPublicPath(req)) {
        return next()
    }

    if (req.method !== 'POST' || req.path !== '/convert') {
        return next()
    }

    if (isAuthorized(getProvidedKey(req))) {
        return next()
    }

    ( req.logger as Logger ).warn('Unauthorized', {path: req.path})

    res.status(401)
        .json({error: 'Unauthorized'})
})

/**
 * CORS preflight middleware: answers every `OPTIONS` request with `204` and
 * permissive CORS headers. Intentionally silent (no logging) and public, so
 * browsers can probe `POST /convert` (which uses the non-safelisted
 * `x-api-key` header) without credentials.
 */
app.use((req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'OPTIONS') {
        return next()
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, Authorization')
    res.setHeader('Content-Length', '0')
    res.status(204).end()
})

/**
 * `GET /health` — public liveness probe reporting status, auth mode,
 * conversion-pool load, and configured limits. Excluded from auth and rate
 * limiting so load-balancer and Docker healthchecks never trip.
 */
app.get('/health', (_req, res) => {
    res.json({
        authEnabled: AUTH_ENABLED,
        concurrency: {
            active: pool.activeCount,
            queued: pool.queuedCount,
            max: pool.maxCount,
        },
        maxFileSize: MAX_FILE_SIZE,
        rateLimit: {
            max: RATE_LIMIT_MAX,
            windowMs: RATE_LIMIT_WINDOW_MS,
        },
        status: 'ok',
        timeoutMs: CONVERT_TIMEOUT_MS,
    })
})

/**
 * `GET /robots.txt` — public crawler directive disallowing all indexing
 * (`User-agent: *` + `Disallow: /`). Silent by design: no auth, no rate
 * limiting, no logging.
 */
app.get('/robots.txt', (_req, res) => {
    res.type('text/plain')
        .send([
            'User-agent: *',
            'Disallow: /',
        ].join('\n'))
})

/**
 * `POST /convert` — converts an uploaded `.docx` (`multipart` field `file`)
 * to PDF and streams it back as `application/pdf` with an inline
 * `Content-Disposition` filename sanitized to `[A-Za-z0-9._-]`.
 *
 * Flow: presence check (`412` when the field is missing) → extension check
 * (`412`) → semaphore slot → `convertDocxToPdf` (magic-byte, LibreOffice and
 * `%PDF` checks inside) → PDF response. The slot is always released in a
 * `finally` block. Conversion errors propagate to the typed error handler.
 */
app.post('/convert', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    const started = Date.now()
    const logger = req.logger as Logger

    try {
        const file = req.file

        if (!file) {
            logger.warn('convert aborted', {reason: 'missing_file'})

            return res.status(412)
                .json({error: 'Missing required multipart field `file`'})
        }

        if (!isSupportedDocument(file.originalname)) {
            logger.warn('convert aborted', {
                filename: file.originalname,
                reason: 'unsupported_extension',
            })

            return res.status(412)
                .json({error: `Unsupported file extension "${file.originalname}". Only .docx is allowed`})
        }

        logger.info('convert start', {
            filename: file.originalname,
            sizeBytes: file.size,
        })

        if (pool.queuedCount > 0) {
            logger.debug('convert waiting', {
                queued: pool.queuedCount,
            })
        }

        const release = await pool.acquire()

        logger.debug('convert slot acquired', {
            active: pool.activeCount,
            queued: pool.queuedCount,
        })

        try {
            const pdf = await convertDocxToPdf(file.buffer, file.originalname, {
                timeoutMs: CONVERT_TIMEOUT_MS,
            })

            const baseName = sanitizeBaseName(file.originalname.replace(/\.docx$/i, ''), 'document')

            logger.info('convert done', {
                filename: `${baseName}.pdf`,
                sizeBytes: pdf.length,
                durationMs: Date.now() - started,
            })

            res.setHeader('Content-Type', 'application/pdf')
            res.setHeader('Content-Disposition', `inline; filename="${baseName}.pdf"`)
            res.send(pdf)
        } finally {
            release()
        }
    } catch (e) {
        next(e)
    }
})

/**
 * Catch-all for unmapped paths: silent JSON `404 { error: 'Not found' }`.
 * Deliberately auth-free and log-free so scanner noise (`/`, `/favicon.ico`,
 * …) neither pollutes logs nor reveals whether auth is enabled.
 */
app.use((_req: Request, res: Response) => {
    res.status(404)
        .json({error: 'Not found'})
})

/**
 * Typed error handler (must stay after all routes).
 *
 * Maps {@link ConversionError} codes to statuses (`UNSUPPORTED_TYPE`→400,
 * `INVALID_CONTENT`→415, anything else→500), Multer upload errors to 400,
 * and every unexpected failure to a generic 500 without leaking internals.
 */
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const logger = req.logger as Logger

    if (err instanceof ConversionError) {
        let status: number

        switch (err.code) {
            case 'UNSUPPORTED_TYPE':
                status = 400
                break
            case 'INVALID_CONTENT':
                status = 415
                break
            default:
                status = 500
        }

        logger.error('convert failed', {
            code: err.code,
            message: err.message,
            status,
            stderr: err.stderr,
        })

        return res.status(status)
            .json({error: err.message})
    }

    if (err instanceof multer.MulterError) {
        logger.error('upload failed', {
            code: err.code,
            message: err.message,
        })

        return res.status(400)
            .json({error: err.message})
    }

    logger.error('internal error', {
        message: err instanceof Error ? err.message : String(err),
    })

    res.status(500)
        .json({error: 'Internal conversion failure'})
})

/**
 * Starts the HTTP server and prints the startup banner with the effective
 * runtime configuration (version, port, auth mode, rate limit). Colors are
 * applied via `cli-color` on interactive CLIs only; piped and Docker logs
 * stay plain.
 */
app.listen(PORT, () => {
    const authValue = AUTH_ENABLED
        ? `enabled (${API_KEYS.size} key${API_KEYS.size === 1 ? '' : 's'})`
        : 'disabled (open)'

    console.log([
        `${paint(`docmorph v${VERSION}`, clc.bold.cyan)} listening on ${paint(`:${PORT}`, clc.bold)}`,
        `  ${paint('auth:', clc.blackBright)}       ${paint(authValue, AUTH_ENABLED ? clc.green : clc.yellow)}`,
        `  ${paint('rate limit:', clc.blackBright)} ${paint(`${RATE_LIMIT_MAX} req / ${formatDuration(RATE_LIMIT_WINDOW_MS)}`, clc.magenta)}`,
    ].join('\n'))
})
